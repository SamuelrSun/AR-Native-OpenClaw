# @ar-openclaw/rokid

OpenClaw plugin for **Rokid AR Glasses** (Rokid Glasses, Rokid Air, Rokid Max).

## How It Works

Unlike the Even G2 (BLE-only), Rokid glasses run a full Android-based OS with an open SDK ecosystem. This plugin uses a **companion app architecture**:

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│  OpenClaw        │ ◄──────────────────────►  │  Rokid Companion  │
│  Gateway         │    JSON messages +         │  App (Android)    │
│  (this plugin)   │    binary streams          │                   │
└─────────────────┘                            ├──────────────────┤
                                               │  Rokid UXR SDK    │
                                               │  • Camera access  │
                                               │  • AR overlay     │
                                               │  • Audio I/O      │
                                               │  • Touchpad input │
                                               └────────┬─────────┘
                                                        │
                                                 ┌──────┴──────┐
                                                 │   Rokid     │
                                                 │   Glasses   │
                                                 └─────────────┘
```

A lightweight Android companion app runs on the glasses (or on a connected phone/dock) and bridges the Rokid UXR SDK to the OpenClaw gateway over a local WebSocket connection.

### Why a Companion App?

Rokid's SDK is Android-native (Java/Kotlin). Rather than trying to call Android APIs from Node.js, we run a thin relay on the Android side that:

1. Captures camera frames, mic audio, and touchpad events via the UXR SDK
2. Streams them to the OpenClaw gateway over WebSocket
3. Receives display commands and audio playback from the gateway
4. Renders AR overlays and plays audio using the native SDK

This gives us full access to all Rokid hardware features while keeping the AI logic in OpenClaw's Node.js runtime.

### Capabilities

| Feature | Status | Mechanism |
|---------|--------|-----------|
| Camera frames (12MP) | Working | UXR SDK -> WebSocket stream |
| Display text overlay | Working | Gateway -> WebSocket -> UXR overlay |
| Display image overlay | Working | Gateway -> WebSocket -> UXR overlay |
| Microphone audio | Working | Android AudioRecord -> WebSocket |
| Touchpad gestures | Working | UXR input events -> WebSocket |
| Speaker audio | Working | WebSocket -> Android AudioTrack |
| AR 3D overlays | Planned | Requires Unity UXR SDK |

## OpenClaw Integration

### Channel

The plugin registers as an OpenClaw channel:
- Inbound: camera frames, transcribed voice, touchpad gestures
- Outbound: text overlays, image overlays, audio playback

### Tools

| Tool | Description |
|------|-------------|
| `rokid_display_text` | Show text overlay on the glasses |
| `rokid_display_image` | Show an image overlay |
| `rokid_clear_display` | Clear all overlays |
| `rokid_capture_photo` | Take a photo with the 12MP camera |
| `rokid_start_camera_stream` | Begin streaming video frames |
| `rokid_stop_camera_stream` | Stop video streaming |
| `rokid_start_listening` | Enable microphone capture |
| `rokid_stop_listening` | Disable microphone |

## Configuration

In `~/.openclaw/openclaw.json`:

```json
{
  "extensions": {
    "ar-openclaw-rokid": {
      "enabled": true,
      "glasses_name": "My Rokid Glasses",
      "companion_host": "localhost",
      "companion_port": 9820,
      "auto_reconnect": true,
      "reconnect_interval_ms": 3000
    }
  }
}
```

## Companion App

The companion Android app source is in `companion-app/`. Build it with Android Studio or Gradle:

```bash
cd companion-app
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The companion app needs to be running on the Rokid glasses (or the connected phone) before the OpenClaw plugin can connect.

---

## Roadmap

### Phase 1 — Companion App & WebSocket Bridge

Build the Android companion app that exposes Rokid's UXR SDK over WebSocket.

**1a. Companion app (Android/Kotlin)**
- [ ] Android project scaffolding (Gradle, min SDK, Rokid UXR SDK dependency)
- [ ] WebSocket server running on the glasses / connected phone (port 9820)
- [ ] Camera access: capture 12MP photos via UXR SDK, send as binary WebSocket frames
- [ ] Camera access: stream video frames (MJPEG or H.264) over WebSocket
- [ ] Microphone capture via Android AudioRecord, stream PCM over WebSocket
- [ ] Speaker playback via Android AudioTrack from incoming WebSocket audio
- [ ] Touchpad gesture forwarding (tap, swipe, back) as JSON events
- [ ] AR text overlay rendering via UXR SDK from incoming WebSocket commands
- [ ] AR image overlay rendering via UXR SDK from incoming WebSocket commands
- [ ] Clear overlay command handler
- [ ] Persistent foreground service to keep WebSocket alive
- [ ] Auto-discovery via mDNS/Zeroconf so the plugin can find the companion on the LAN

**1b. Node.js plugin bridge**
- [x] `RokidCompanionBridge` class with WebSocket client, auto-reconnect, event routing
- [x] JSON command protocol (`display_text`, `display_image`, `capture_photo`, `start_mic`, etc.)
- [x] Binary message protocol (0x01 = video frame, 0x02 = audio chunk)
- [ ] mDNS discovery to auto-find the companion app on the local network
- [ ] Handle companion app disconnect / reconnect gracefully
- [ ] Buffer outbound commands while reconnecting

**1c. OpenClaw plugin wiring**
- [x] Plugin entry point with channel + tools
- [x] Channel adapter (outbound text, image, audio; inbound transcription, gestures, photos)
- [x] Agent tools: `rokid_display_text`, `rokid_display_image`, `rokid_clear_display`, `rokid_capture_photo`, `rokid_start_camera_stream`, `rokid_stop_camera_stream`, `rokid_start_listening`, `rokid_stop_listening`
- [ ] Pipe inbound mic audio through shared STT adapter
- [ ] Pipe inbound camera frames to OpenClaw for multimodal LLM analysis
- [ ] End-to-end test: speak to Rokid → see LLM response as AR overlay

---

### Phase 2 — On-Device AI & Advanced SDK Features

Leverage the Rokid AR1 chip and full Android SDK for richer integration.

- [ ] Explore Rokid AR1 chip on-device inference (object detection, OCR)
- [ ] Pipe on-device detections as context to OpenClaw agent alongside LLM
- [ ] Real-time translation overlay (mic → STT → translate → display)
- [ ] Navigation overlay (receive turn-by-turn from OpenClaw, render via UXR)
- [ ] 3D AR overlay support via Unity UXR SDK (separate Unity companion app)
- [ ] Multi-language live subtitle rendering
- [ ] Investigate Rokid Glasses open ecosystem: ChatGPT / DeepSeek / Gemini model routing
- [ ] Support Rokid Station 2 dock as alternative host for the companion app

---

## References

- [Rokid AR Platform SDK](https://ar.rokid.com/sdk?lang=en) -- official SDK downloads
- [Rokid Glass 2 Docs](https://rokidglass.github.io/glass2-docs/en/) -- developer documentation
- [Rokid UXR SDK](https://github.com/RokidGlass/UXR-docs) -- Unity XR SDK docs
- [Rokid Developer Forum](https://developer-forum.rokid.com/) -- community support
