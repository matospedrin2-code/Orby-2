"""Backend tests for Orby companion assistant."""
import base64
import io
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from PIL import Image

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: read from frontend/.env
    envp = Path("/app/frontend/.env")
    for line in envp.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

SESSION = f"TEST_orby_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup
    try:
        requests.delete(f"{BASE_URL}/api/history/{SESSION}", timeout=10)
        requests.delete(f"{BASE_URL}/api/memories/{SESSION}", timeout=10)
    except Exception:
        pass


# ---------------------------------------------------------------- health
def test_root(api):
    r = api.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert "Orby" in r.json().get("message", "")


# ---------------------------------------------------------------- local intents
def test_chat_local_horas(api):
    """que horas são should be served locally with hud.modo=relogio (no Gemini)."""
    body = {
        "session_id": SESSION,
        "text": "que horas são",
        "client_time": "2026-01-15T14:30:00",
        "speak": False,
    }
    r = api.post(f"{BASE_URL}/api/chat", json=body, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["kind"] == "local"
    assert data["hud"] and data["hud"].get("modo") == "relogio"
    assert "14" in data["fala"]  # hour 14


# ---------------------------------------------------------------- chat with Gemini + actions
def test_chat_email_action(api):
    body = {
        "session_id": SESSION,
        "text": "manda um email para joao@x.com dizendo oi",
        "client_time": "2026-01-15T10:00:00",
        "speak": False,
    }
    r = api.post(f"{BASE_URL}/api/chat", json=body, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["acao"] is not None, f"expected action, got {data}"
    assert data["acao"].get("tipo") == "email", f"got {data['acao']}"


def test_chat_agenda_action(api):
    body = {
        "session_id": SESSION,
        "text": "marca reunião amanhã 10h na agenda",
        "client_time": "2026-01-15T09:00:00",
        "speak": False,
    }
    r = api.post(f"{BASE_URL}/api/chat", json=body, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["acao"] is not None, f"expected action, got {data}"
    assert data["acao"].get("tipo") == "agenda", f"got {data['acao']}"


def test_chat_timer_action(api):
    body = {
        "session_id": SESSION,
        "text": "coloca um timer de 1 minuto",
        "client_time": "2026-01-15T09:00:00",
        "speak": False,
    }
    r = api.post(f"{BASE_URL}/api/chat", json=body, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["acao"] is not None, f"expected action, got {data}"
    assert data["acao"].get("tipo") == "timer", f"got {data['acao']}"


# ---------------------------------------------------------------- chat basic reply shape + audio
def test_chat_basic_reply_shape_with_audio(api):
    body = {
        "session_id": SESSION,
        "text": "Me explica o que é fotossíntese em uma frase",
        "client_time": "2026-01-15T09:00:00",
        "voice": "verse",
        "speak": True,
    }
    r = api.post(f"{BASE_URL}/api/chat", json=body, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("fala", "expressao", "hud", "acao", "audio_url", "kind"):
        assert k in data, f"missing key {k}"
    assert isinstance(data["fala"], str) and len(data["fala"]) > 0
    # audio_url served
    if data["audio_url"]:
        assert re.match(r"^/api/tts/[a-f0-9]{32}\.mp3$", data["audio_url"])
        audio_r = requests.get(f"{BASE_URL}{data['audio_url']}", timeout=30)
        assert audio_r.status_code == 200
        assert audio_r.headers.get("content-type", "").startswith("audio/mpeg")
        assert len(audio_r.content) > 1000


# ---------------------------------------------------------------- /api/tts
def test_tts_endpoint(api):
    r = api.post(
        f"{BASE_URL}/api/tts",
        json={"text": "Oi, eu sou o Orby.", "voice": "verse"},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["audio_url"] and re.match(r"^/api/tts/[a-f0-9]{32}\.mp3$", data["audio_url"])
    audio_r = requests.get(f"{BASE_URL}{data['audio_url']}", timeout=30)
    assert audio_r.status_code == 200
    assert audio_r.headers.get("content-type", "").startswith("audio/mpeg")


def test_tts_invalid_key_returns_404():
    r = requests.get(f"{BASE_URL}/api/tts/notavalidkey.mp3", timeout=10)
    assert r.status_code == 404


# ---------------------------------------------------------------- /api/vision
def _real_image_b64():
    """Create a real-looking JPEG with features (not blank)."""
    img = Image.new("RGB", (320, 240), (30, 50, 90))
    # add gradient and shapes for real visual features
    px = img.load()
    for y in range(240):
        for x in range(320):
            px[x, y] = ((x * 255) // 320, (y * 255) // 240, ((x + y) * 255) // 560)
    # draw a rectangle
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    d.rectangle([60, 60, 260, 180], fill=(240, 230, 80), outline=(10, 10, 10), width=4)
    d.ellipse([120, 90, 200, 170], fill=(220, 40, 60))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def test_vision_endpoint(api):
    b64 = _real_image_b64()
    body = {
        "session_id": SESSION,
        "text": "O que você está vendo? Me diga em uma frase curta.",
        "client_time": "2026-01-15T09:00:00",
        "image_base64": b64,
        "speak": False,
    }
    r = api.post(f"{BASE_URL}/api/vision", json=body, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["kind"] == "vision"
    assert isinstance(data["fala"], str) and len(data["fala"]) > 0


def test_vision_rejects_small_image(api):
    r = api.post(
        f"{BASE_URL}/api/vision",
        json={"session_id": SESSION, "text": "ver", "image_base64": "abc123"},
        timeout=30,
    )
    assert r.status_code == 400


# ---------------------------------------------------------------- /api/voice-turn
def _tts_mp3_bytes(text: str) -> bytes:
    """Generate real Portuguese speech via /api/tts and fetch mp3 bytes."""
    r = requests.post(
        f"{BASE_URL}/api/tts",
        json={"text": text, "voice": "verse"},
        timeout=90,
    )
    r.raise_for_status()
    url = r.json()["audio_url"]
    audio = requests.get(f"{BASE_URL}{url}", timeout=60)
    audio.raise_for_status()
    return audio.content


def test_voice_turn_with_wake_word():
    audio_bytes = _tts_mp3_bytes("Orby, qual a capital do Brasil?")
    files = {"audio": ("fala.mp3", audio_bytes, "audio/mpeg")}
    data = {
        "session_id": SESSION,
        "require_wake": "1",
        "name": "",
        "client_time": "2026-01-15T09:00:00",
        "voice": "verse",
        "speak": "0",
        "battery": "",
        "image_base64": "",
    }
    r = requests.post(f"{BASE_URL}/api/voice-turn", files=files, data=data, timeout=180)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("woke") is True, f"expected woke=True, got {j}"
    assert "transcript" in j and j["transcript"]
    assert "fala" in j


def test_voice_turn_no_wake_word():
    audio_bytes = _tts_mp3_bytes("Qual a capital do Brasil?")
    files = {"audio": ("fala.mp3", audio_bytes, "audio/mpeg")}
    data = {
        "session_id": SESSION,
        "require_wake": "1",
        "speak": "0",
    }
    r = requests.post(f"{BASE_URL}/api/voice-turn", files=files, data=data, timeout=120)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("woke") is False, f"expected woke=False, got {j}"
    assert j.get("reason") == "no_wake", f"expected reason=no_wake, got {j}"


def test_voice_turn_require_wake_zero_answers():
    audio_bytes = _tts_mp3_bytes("Qual a capital do Brasil?")
    files = {"audio": ("fala.mp3", audio_bytes, "audio/mpeg")}
    data = {
        "session_id": SESSION,
        "require_wake": "0",
        "speak": "0",
        "client_time": "2026-01-15T09:00:00",
    }
    r = requests.post(f"{BASE_URL}/api/voice-turn", files=files, data=data, timeout=180)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("woke") is True, f"expected woke=True (bypassed), got {j}"
    assert j.get("fala"), f"expected a fala response, got {j}"


def test_voice_turn_too_short():
    files = {"audio": ("fala.m4a", b"\x00" * 500, "audio/mp4")}
    data = {"session_id": SESSION, "require_wake": "1"}
    r = requests.post(f"{BASE_URL}/api/voice-turn", files=files, data=data, timeout=30)
    assert r.status_code == 200
    assert r.json().get("reason") == "too_short"


# ---------------------------------------------------------------- history + memories
def test_history_returns_messages(api):
    r = api.get(f"{BASE_URL}/api/history/{SESSION}", timeout=20)
    assert r.status_code == 200
    hist = r.json()
    assert isinstance(hist, list)
    # we've sent several chats; must have content
    assert len(hist) > 0
    # must not expose mongo _id
    for item in hist:
        assert "_id" not in item
        assert "role" in item and "text" in item


def test_memories_endpoint(api):
    r = api.get(f"{BASE_URL}/api/memories/{SESSION}", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_clear_history_and_memories(api):
    r1 = requests.delete(f"{BASE_URL}/api/history/{SESSION}", timeout=20)
    assert r1.status_code == 200 and r1.json().get("ok") is True
    r2 = requests.delete(f"{BASE_URL}/api/memories/{SESSION}", timeout=20)
    assert r2.status_code == 200 and r2.json().get("ok") is True
    r3 = api.get(f"{BASE_URL}/api/history/{SESSION}", timeout=20)
    assert r3.status_code == 200 and r3.json() == []


# ---------------------------------------------------------------- validation
def test_chat_empty_text_rejected(api):
    r = api.post(
        f"{BASE_URL}/api/chat",
        json={"session_id": SESSION, "text": "   "},
        timeout=20,
    )
    assert r.status_code == 400
