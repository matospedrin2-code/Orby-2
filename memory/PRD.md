# Orby — PRD

## Original problem statement
Recreate "Orby" (previously a Kotlin app built in Google AI Studio) as a mobile app: a robot companion with an animated face made of neon eyes (expressions, natural blinking, small glances around), eyes that follow the user through the camera, a sci-fi HUD panel on the LEFT (clock/battery and a "Resumo" panel with captions that scroll by themselves, angled corners, neon cyan #00F0FF), a microphone that is always on and listens for its name, Gemini intelligence, a Gemini Live camera mode that describes what it sees, and assistant actions (calendar, e-mail, etc.). Portuguese (BR).

## User choices
- Listening: always on, rest mode, wakes when the user says "Orby"
- Eye tracking: instant, on the phone (native build only)
- Voice: realistic AI voice
- Brain: Gemini 3 Flash with the Emergent key

## Architecture
- Backend FastAPI (/app/backend/server.py), MongoDB collections: messages, memories. TTS mp3 cache stored on disk (backend/tts_cache).
  - /api/chat, /api/vision, /api/voice-turn (gpt-4o-mini-transcribe → wake-word check → local intents or Gemini 3 Flash JSON reply → gpt-4o-mini-tts), /api/tts, /api/tts/{key}.mp3, /api/history, /api/memories
- Frontend Expo SDK 58, single screen (app/index.tsx)
  - RobotFace (Reanimated spring morph across 17 expressions, squash blink, breathing, speaking bounce, Zz sleep)
  - HudPanel (SVG chamfered polygon, gradient, glow, LED stripes, wifi, clock+battery, auto-scrolling summary)
  - useVoiceLoop (expo-audio metering voice detection, adaptive noise floor, configurable pause, up to 60 min per utterance, half-duplex)
  - FaceTracker (VisionCamera v5 + face-detector, native only; .web stub), LiveCamera (expo-camera snapshots → Gemini vision)
  - Actions via Linking: email, Google Calendar, call, WhatsApp, maps, web, YouTube, in-app timer, sleep

## Implemented (2026-06)
- Everything above; tested by the testing agent: backend 18/18, frontend flows pass on web

## Notes
- On-device face tracking only works in an installed build (Publish → build). Not in Expo Go or on the web.
- Every speech segment heard in rest mode is sent for transcription, so listening uses the AI key.

## Backlog
- P1: Free on-device wake word detection (native speech recognition) so that rest mode doesn't use the AI key
- P1: Real-time streaming conversation that can be interrupted (Realtime voice)
- P2: Continuous Gemini Live narration, reminders/alarms, more expressions
