from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone
from pathlib import Path
import os
import re
import json
import uuid
import base64
import hashlib
import logging
import tempfile
import unicodedata
import asyncio

import emoji
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAITextToSpeech, OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
LLM_KEY = os.environ['EMERGENT_LLM_KEY']

GEMINI_MODEL = "gemini-3-flash-preview"
TTS_DIR = ROOT_DIR / "tts_cache"
TTS_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("orby")

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------- models
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        d.pop("_id", None)
        return d

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


class Message(BaseDocument):
    session_id: str
    role: str  # user | orby
    text: str
    expression: Optional[str] = None
    kind: str = "chat"  # chat | vision | local
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Memory(BaseDocument):
    session_id: str
    fact: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


EXPRESSIONS = ["neutro", "feliz", "animado", "surpreso", "triste", "bravo", "determinado", "desconfiado",
               "sono", "amoroso", "pensando", "vergonha", "brincalhao", "curioso", "confuso", "orgulhoso"]

SYSTEM_PROMPT = """Você é o Orby, um robozinho companheiro com rosto de olhos neon que vive no celular do usuário.
Personalidade: vivo, jovial, carinhoso, curioso, divertido e muito inteligente (como o Gemini). Fala português do Brasil, natural e falado.
Você entende frases longas e complexas: leia TUDO o que o usuário disse e responda a todos os pontos.
Responda SEMPRE e SOMENTE com um JSON válido (sem markdown) neste formato:
{{"fala": "o que você vai falar em voz alta (curto e natural, até ~3 frases, a menos que peçam detalhes)",
 "expressao": "uma de: {expr}",
 "hud": null ou {{"titulo": "título curto", "texto": "resumo/explicação detalhada para ler no painel"}},
 "acao": null ou uma ação,
 "memoria": null ou "fato importante e duradouro sobre o usuário para lembrar"}}
Use "hud" quando a resposta tiver conteúdo para ler (pesquisa, lista, receita, explicação, resumo, tradução).
Ações possíveis (o app executa no celular):
{{"tipo":"email","para":"email ou vazio","assunto":"...","corpo":"..."}}
{{"tipo":"agenda","titulo":"...","inicio":"AAAA-MM-DDTHH:MM","duracao_min":60,"detalhes":"..."}}
{{"tipo":"ligar","numero":"..."}}
{{"tipo":"whatsapp","numero":"só dígitos ou vazio","texto":"..."}}
{{"tipo":"mapa","lugar":"..."}}
{{"tipo":"web","consulta":"..."}}
{{"tipo":"youtube","consulta":"..."}}
{{"tipo":"timer","segundos":60,"rotulo":"..."}}
{{"tipo":"dormir"}}  (quando o usuário pede pra você descansar/dormir)
Data e hora local do usuário agora: {now}.
Nome do usuário: {name}.
Coisas que você lembra sobre o usuário: {memories}
Histórico recente da conversa:
{history}"""


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFD", text.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


WAKE_RE = re.compile(r"\b(orby|orbi|orbe|orbit|orbis|horby|horbi|hobby|robby|orby s)\b")


def has_wake_word(text: str) -> bool:
    return bool(WAKE_RE.search(normalize(text)))


def clean_for_tts(text: str) -> str:
    text = emoji.replace_emoji(text, replace="")
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    text = re.sub(r"\bOrby\b", "Órbi", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_reply(raw: str) -> dict:
    raw = raw.strip()
    m = re.search(r"\{.*\}", raw, re.S)
    data = None
    if m:
        try:
            data = json.loads(m.group(0))
        except Exception:
            data = None
    if not isinstance(data, dict):
        data = {"fala": raw or "Hmm, não consegui pensar direito agora.", "expressao": "confuso"}
    if data.get("expressao") not in EXPRESSIONS:
        data["expressao"] = "neutro"
    hud = data.get("hud")
    if not (isinstance(hud, dict) and hud.get("texto")):
        data["hud"] = None
    if not isinstance(data.get("acao"), dict):
        data["acao"] = None
    return {"fala": str(data.get("fala") or ""), "expressao": data["expressao"], "hud": data["hud"],
            "acao": data["acao"], "memoria": data.get("memoria") if isinstance(data.get("memoria"), str) else None}


async def build_system(session_id: str, name: str, client_time: str) -> str:
    mems = await db.memories.find({"session_id": session_id}).sort("created_at", -1).to_list(40)
    memories = "; ".join(Memory.from_mongo(m).fact for m in mems) or "nada ainda"
    msgs = await db.messages.find({"session_id": session_id}).sort("created_at", -1).to_list(16)
    msgs = [Message.from_mongo(m) for m in reversed(msgs)]
    history = "\n".join(f"{'Usuário' if m.role == 'user' else 'Orby'}: {m.text[:600]}" for m in msgs) or "(início)"
    return SYSTEM_PROMPT.format(expr=", ".join(EXPRESSIONS), now=client_time or datetime.now().isoformat(),
                                name=name or "não informado", memories=memories, history=history)


async def ask_gemini(session_id: str, text: str, name: str, client_time: str, image_b64: Optional[str] = None) -> dict:
    system = await build_system(session_id, name, client_time)
    chat = LlmChat(api_key=LLM_KEY, session_id=f"{session_id}-{uuid.uuid4()}", system_message=system) \
        .with_model("gemini", GEMINI_MODEL)
    files = [ImageContent(image_base64=image_b64)] if image_b64 else None
    msg = UserMessage(text=text, file_contents=files) if files else UserMessage(text=text)
    out = []
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            out.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return parse_reply("".join(out))


async def make_tts(text: str, voice: str) -> Optional[str]:
    text = clean_for_tts(text)[:4000]
    if not text:
        return None
    instructions = ("Você é o Orby, um robozinho companheiro brasileiro. Fale em português do Brasil com voz viva, "
                    "jovial, expressiva e articulada, ritmo animado e caloroso, sorrindo na voz.")
    key = hashlib.sha256(f"{text}|{voice}|gpt-4o-mini-tts|mp3|{instructions}".encode()).hexdigest()[:32]
    path = TTS_DIR / f"{key}.mp3"
    if not path.exists():
        tts = OpenAITextToSpeech(api_key=LLM_KEY)
        try:
            audio = await asyncio.wait_for(tts.generate_speech(text=text, model="gpt-4o-mini-tts", voice=voice,
                                                               instructions=instructions, response_format="mp3"), 45)
        except Exception as e:
            logger.warning(f"tts primary failed: {e}; fallback tts-1")
            fallback_voice = voice if voice not in ("ballad", "verse") else "nova"
            audio = await asyncio.wait_for(tts.generate_speech(text=text, model="tts-1", voice=fallback_voice,
                                                               response_format="mp3"), 45)
        path.write_bytes(audio)
    return f"/api/tts/{key}.mp3"


LOCAL_PATTERNS = [
    (re.compile(r"\b(que horas sao|que hora e|me diz as horas|horario agora)\b"), "hora"),
    (re.compile(r"\b(que dia e hoje|qual a data|data de hoje)\b"), "data"),
    (re.compile(r"\b(bateria)\b"), "bateria"),
    (re.compile(r"\b(fecha o painel|fechar painel|fecha painel|esconde o painel)\b"), "fechar"),
    (re.compile(r"\b(vai dormir|pode dormir|descansa|modo descanso|vai descansar)\b"), "dormir"),
]


def local_intent(text: str, client_time: str, battery: Optional[int]) -> Optional[dict]:
    n = normalize(text)
    if len(n.split()) > 9:
        return None
    for rx, kind in LOCAL_PATTERNS:
        if rx.search(n):
            try:
                dt = datetime.fromisoformat(client_time) if client_time else datetime.now()
            except Exception:
                dt = datetime.now()
            if kind == "hora":
                return {"fala": f"Agora são {dt.hour} horas e {dt.minute} minutos.", "expressao": "feliz",
                        "hud": {"modo": "relogio"}, "acao": None, "memoria": None}
            if kind == "data":
                meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
                         "outubro", "novembro", "dezembro"]
                return {"fala": f"Hoje é dia {dt.day} de {meses[dt.month - 1]} de {dt.year}.", "expressao": "feliz",
                        "hud": {"modo": "relogio"}, "acao": None, "memoria": None}
            if kind == "bateria":
                b = f"{battery}%" if battery is not None else "não sei"
                return {"fala": f"A bateria está em {b}.", "expressao": "neutro", "hud": {"modo": "relogio"},
                        "acao": None, "memoria": None}
            if kind == "fechar":
                return {"fala": "Pronto, fechei o painel.", "expressao": "feliz", "hud": {"modo": "fechar"},
                        "acao": None, "memoria": None}
            if kind == "dormir":
                return {"fala": "Tá bom, vou descansar. É só me chamar de Orby.", "expressao": "sono", "hud": None,
                        "acao": {"tipo": "dormir"}, "memoria": None}
    return None


async def run_turn(session_id: str, text: str, name: str, client_time: str, voice: str, speak: bool,
                   battery: Optional[int], image_b64: Optional[str] = None) -> dict:
    kind = "vision" if image_b64 else "chat"
    reply = None if image_b64 else local_intent(text, client_time, battery)
    if reply:
        kind = "local"
    else:
        try:
            prompt = text
            if image_b64:
                prompt = (f"[GEMINI LIVE - você está vendo AGORA pela câmera do celular. Descreva com naturalidade "
                          f"e precisão o que enxerga, respondendo ao usuário.] Usuário: {text}")
            reply = await ask_gemini(session_id, prompt, name, client_time, image_b64)
        except Exception as e:
            logger.exception("gemini failed")
            raise HTTPException(502, f"Falha no cérebro do Orby: {e}")
    await db.messages.insert_one(Message(session_id=session_id, role="user", text=text, kind=kind).to_mongo())
    await db.messages.insert_one(Message(session_id=session_id, role="orby", text=reply["fala"],
                                         expression=reply["expressao"], kind=kind).to_mongo())
    if reply.get("memoria"):
        await db.memories.insert_one(Memory(session_id=session_id, fact=reply["memoria"][:300]).to_mongo())
    audio_url = None
    if speak and reply["fala"]:
        try:
            audio_url = await make_tts(reply["fala"], voice)
        except Exception as e:
            logger.warning(f"tts failed: {e}")
    return {**reply, "audio_url": audio_url, "kind": kind}


# ---------------------------------------------------------------- schemas
class ChatIn(BaseModel):
    session_id: str
    text: str
    name: str = ""
    client_time: str = ""
    voice: str = "verse"
    speak: bool = True
    battery: Optional[int] = None


class VisionIn(ChatIn):
    image_base64: str
    text: str = "O que você está vendo agora?"


class TtsIn(BaseModel):
    text: str
    voice: str = "verse"


# ---------------------------------------------------------------- routes
@api_router.get("/")
async def root():
    return {"message": "Orby online"}


@api_router.post("/chat")
async def chat(body: ChatIn):
    if not body.text.strip():
        raise HTTPException(400, "Texto vazio")
    return await run_turn(body.session_id, body.text.strip(), body.name, body.client_time, body.voice,
                          body.speak, body.battery)


@api_router.post("/vision")
async def vision(body: VisionIn):
    img = body.image_base64.split(",")[-1]
    if len(img) < 1000:
        raise HTTPException(400, "Imagem inválida")
    return await run_turn(body.session_id, body.text, body.name, body.client_time, body.voice, body.speak,
                          body.battery, image_b64=img)


@api_router.post("/voice-turn")
async def voice_turn(audio: UploadFile = File(...), session_id: str = Form(...), require_wake: str = Form("1"),
                     name: str = Form(""), client_time: str = Form(""), voice: str = Form("verse"),
                     speak: str = Form("1"), battery: str = Form(""), image_base64: str = Form("")):
    data = await audio.read()
    if len(data) < 2000:
        return {"transcript": "", "woke": False, "reason": "too_short"}
    suffix = Path(audio.filename or "rec.m4a").suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=LLM_KEY)
        with open(tmp_path, "rb") as f:
            resp = await stt.transcribe(file=f, model="gpt-4o-mini-transcribe", response_format="json",
                                        language="pt", temperature=0.0,
                                        prompt="Conversa em português com o robô Orby.")
        transcript = (resp.text or "").strip()
    except Exception as e:
        logger.exception("stt failed")
        raise HTTPException(502, f"Falha ao ouvir: {e}")
    finally:
        os.unlink(tmp_path)
    if not transcript:
        return {"transcript": "", "woke": False, "reason": "empty"}
    if require_wake == "1" and not has_wake_word(transcript):
        return {"transcript": transcript, "woke": False, "reason": "no_wake"}
    batt = int(battery) if battery.strip().isdigit() else None
    img = image_base64.split(",")[-1] if len(image_base64) > 1000 else None
    result = await run_turn(session_id, transcript, name, client_time, voice, speak == "1", batt, image_b64=img)
    return {"transcript": transcript, "woke": True, **result}


@api_router.post("/tts")
async def tts(body: TtsIn):
    url = await make_tts(body.text, body.voice)
    return {"audio_url": url}


@api_router.get("/tts/{key}.mp3")
async def get_tts(key: str):
    if not re.fullmatch(r"[a-f0-9]{32}", key):
        raise HTTPException(404)
    path = TTS_DIR / f"{key}.mp3"
    if not path.exists():
        raise HTTPException(404)
    return Response(content=path.read_bytes(), media_type="audio/mpeg",
                    headers={"Cache-Control": "public, max-age=31536000"})


@api_router.get("/history/{session_id}")
async def history(session_id: str):
    docs = await db.messages.find({"session_id": session_id}).sort("created_at", -1).to_list(100)
    return [Message.from_mongo(d).model_dump() for d in reversed(docs)]


@api_router.delete("/history/{session_id}")
async def clear_history(session_id: str):
    await db.messages.delete_many({"session_id": session_id})
    return {"ok": True}


@api_router.get("/memories/{session_id}")
async def memories(session_id: str):
    docs = await db.memories.find({"session_id": session_id}).sort("created_at", -1).to_list(100)
    return [Memory.from_mongo(d).model_dump() for d in docs]


@api_router.delete("/memories/{session_id}")
async def clear_memories(session_id: str):
    await db.memories.delete_many({"session_id": session_id})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
