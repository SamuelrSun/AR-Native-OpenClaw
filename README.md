# AR-Native-OpenClaw

OpenClaw plugins for AR smart glasses. Run your personal AI assistant hands-free on Even Realities G2, Rokid Glasses, and Meta Ray-Bans.

Each directory contains a standalone OpenClaw plugin that bridges the glasses' hardware (display, camera, microphone) into the OpenClaw agent runtime so the assistant can see what you see, hear what you hear, and show you information in your field of view.

---

## Roadmap

### Phase 0 — Foundation & Shared Infrastructure

Monorepo scaffolding, shared types, and cross-platform utilities that all three plugins depend on.

- [x] Initialize pnpm workspace with `shared/`, `even-realities-g2/`, `rokid/`, `meta-raybans/`
- [x] Define cross-platform TypeScript types (`ARDevice`, `DeviceCapabilities`, `InboundMessage`, `OutboundMessage`)
- [x] Implement text layout engine (word-wrap + pagination for small displays)
- [x] Implement image utilities (RGBA → 1-bit BMP conversion, nearest-neighbor resize, BLE packet splitting)
- [x] Define `ConnectionState` FSM and `ConnectionEvent` types
- [ ] Add shared STT (speech-to-text) adapter interface (Whisper, Deepgram, on-device)
- [ ] Add shared TTS (text-to-speech) adapter interface (OpenAI, ElevenLabs, on-device)
- [ ] Build shared WebSocket server base class (reused by Rokid + Meta companion bridges)
- [ ] Write unit tests for text-layout and image-utils
- [ ] CI pipeline (GitHub Actions: lint, build, test across all packages)

---

### Phase 1 — Even Realities G2: BLE Connectivity & Display

Get a Node.js process talking to the G2 over Bluetooth and rendering text on the HUD.

**1a. BLE connection & protocol**
- [x] Implement CRC-16/CCITT (poly 0x1021, init 0xFFFF)
- [x] Implement `buildPacket()` / `parsePacket()` for the G2 wire format
- [x] Define all command constants (`0x4E` text, `0x15` image, `0x0E` mic, `0xF1` audio, `0xF5` touch)
- [ ] BLE scanning via Noble — discover G2 by service UUID
- [ ] Dual-arm connection (left arm first, then right arm)
- [ ] Implement full 7-packet authentication handshake
- [ ] Subscribe to Content Channel (0x5401) notifications
- [ ] Subscribe to Rendering Channel (0x6402) notifications
- [ ] Handle BLE disconnect + auto-reconnect with backoff
- [ ] Integration test: connect to real G2 hardware and log handshake

**1b. HUD display output**
- [ ] Send single-screen text via `0x4E` command
- [ ] Multi-screen text pagination (auto-advance + TouchBar manual advance)
- [ ] Send 1-bit BMP images via `0x15` (194-byte packets + termination + CRC32 verify)
- [ ] Clear display command
- [ ] Handle display status bytes (lower 4-bit screen state, upper 4-bit AI mode)
- [ ] Integration test: display "Hello from OpenClaw" on real G2

**1c. OpenClaw plugin wiring**
- [x] Plugin entry point (`register(api)`) with channel + tools
- [x] Channel adapter (outbound `sendText` with layout, `sendImage`)
- [x] Agent tools: `even_g2_display_text`, `even_g2_display_image`, `even_g2_clear_display`
- [ ] Gateway RPC status endpoint returning live connection state
- [ ] End-to-end test: send a message via OpenClaw chat → see it on the G2 HUD

---

### Phase 2 — Even Realities G2: Microphone & Voice Input

Enable the G2's mic so the agent can hear the user and respond on the HUD.

- [ ] Send mic enable command (`0x0E 0x01`) and receive LC3 audio stream (`0xF1`)
- [ ] Decode LC3 frames to PCM (via `lc3` npm package or WASM decoder)
- [ ] Pipe PCM to the shared STT adapter (Whisper / Deepgram / etc.)
- [ ] Forward transcribed text to OpenClaw as an inbound channel message
- [ ] Handle TouchBar long-press (`0xF5 0x17`) to trigger "push-to-talk" activation
- [ ] Send mic disable command (`0x0E 0x00`) on release / timeout
- [x] Agent tools: `even_g2_start_listening`, `even_g2_stop_listening`
- [ ] Integration test: speak into G2 mic → see transcription in OpenClaw chat

---

### Phase 3 — Even Realities G2: Even AI Passthrough & Advanced Features

Wire up the native Even AI activation flow and explore Rendering Channel commands.

- [ ] Detect Even AI activation (long-press → `0xF5 0x17`)
- [ ] Intercept AI flow: mic enable → capture audio → run through OpenClaw LLM instead of Even AI
- [ ] Stream LLM response back to HUD via `0x4E` with automatic pagination
- [ ] Map all TouchBar gesture events (tap, double-tap, swipe, long-press) to configurable actions
- [ ] Reverse-engineer Rendering Channel (0x6402) display positioning commands
- [ ] Notification display (app name + count metadata via 0x6402)
- [ ] Calendar widget rendering
- [ ] Navigation turn-by-turn rendering (partial — protocol still under research)
- [ ] Battery level and device status polling

---

### Phase 4 — Rokid Glasses: Companion App & WebSocket Bridge

Build the Android companion app that exposes Rokid's UXR SDK over WebSocket.

**4a. Companion app (Android/Kotlin)**
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

**4b. Node.js plugin bridge**
- [x] `RokidCompanionBridge` class with WebSocket client, auto-reconnect, event routing
- [x] JSON command protocol (`display_text`, `display_image`, `capture_photo`, `start_mic`, etc.)
- [x] Binary message protocol (0x01 = video frame, 0x02 = audio chunk)
- [ ] mDNS discovery to auto-find the companion app on the local network
- [ ] Handle companion app disconnect / reconnect gracefully
- [ ] Buffer outbound commands while reconnecting

**4c. OpenClaw plugin wiring**
- [x] Plugin entry point with channel + tools
- [x] Channel adapter (outbound text, image, audio; inbound transcription, gestures, photos)
- [x] Agent tools: `rokid_display_text`, `rokid_display_image`, `rokid_clear_display`, `rokid_capture_photo`, `rokid_start_camera_stream`, `rokid_stop_camera_stream`, `rokid_start_listening`, `rokid_stop_listening`
- [ ] Pipe inbound mic audio through shared STT adapter
- [ ] Pipe inbound camera frames to OpenClaw for multimodal LLM analysis
- [ ] End-to-end test: speak to Rokid → see LLM response as AR overlay

---

### Phase 5 — Rokid Glasses: On-Device AI & Advanced SDK Features

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

### Phase 6 — Meta Ray-Bans: Companion App & DAT Integration

Build the iOS + Android companion apps wrapping Meta's Wearables Device Access Toolkit.

**6a. Android companion app (Kotlin)**
- [ ] Android project scaffolding (Gradle, GitHub Packages for `mwdat-*` artifacts)
- [ ] Integrate `mwdat-core` for pairing and device lifecycle
- [ ] Integrate `mwdat-camera` for 12MP photo capture
- [ ] Integrate `mwdat-camera` for video streaming
- [ ] Access 5-mic array via Android Bluetooth audio profile
- [ ] Access open-ear speakers via Android Bluetooth audio profile
- [ ] WebSocket server on phone (port 9821)
- [ ] Forward camera frames as binary WebSocket messages
- [ ] Forward mic audio as binary WebSocket messages
- [ ] Receive and play audio from WebSocket on speakers
- [ ] TTS engine (Android TextToSpeech or cloud) for `speak` command
- [ ] Mock Device Kit integration for testing without hardware

**6b. iOS companion app (Swift)**
- [ ] Xcode project scaffolding with DAT Swift SDK via CocoaPods
- [ ] Integrate DAT core for pairing and device lifecycle
- [ ] Camera capture and streaming via DAT
- [ ] Mic access via iOS Bluetooth audio profile
- [ ] Speaker output via iOS Bluetooth audio profile
- [ ] WebSocket server on phone (port 9821)
- [ ] Binary protocol for camera + audio streaming
- [ ] TTS via AVSpeechSynthesizer or cloud for `speak` command

**6c. Node.js plugin bridge**
- [x] `MetaDATBridge` class with WebSocket client, auto-reconnect, event routing
- [x] JSON + binary message protocol
- [ ] mDNS discovery for companion auto-detection
- [ ] Graceful reconnect with command buffering

**6d. OpenClaw plugin wiring**
- [x] Plugin entry point with channel + tools
- [x] Channel adapter (outbound via TTS since no HUD; inbound from camera + mic)
- [x] Agent tools: `meta_rb_capture_photo`, `meta_rb_start_camera_stream`, `meta_rb_stop_camera_stream`, `meta_rb_start_listening`, `meta_rb_stop_listening`, `meta_rb_play_audio`, `meta_rb_speak`
- [ ] Pipe inbound mic audio through shared STT adapter
- [ ] Pipe inbound camera frames to OpenClaw for multimodal LLM analysis
- [ ] End-to-end test: speak to Ray-Bans → hear LLM response through speakers

---

### Phase 7 — Meta Ray-Bans: HUD & Future DAT Capabilities

Track Meta's DAT roadmap and add support as new capabilities land.

- [ ] Monitor DAT updates for Ray-Ban Display HUD access (currently not exposed)
- [ ] When available: send text/images to HUD display
- [ ] Monitor DAT updates for Meta AI ("Hey Meta") integration
- [ ] When available: intercept "Hey Meta" and route through OpenClaw LLM
- [ ] Monitor DAT updates for Neural Band gesture access
- [ ] When available: map gestures to configurable agent actions
- [ ] Support Meta's expected 2026 public publishing of integrations (exit developer preview)
- [ ] Investigate community workarounds (Messenger bot API, WhatsApp integration) as interim HUD-less UX

---

### Phase 8 — Cross-Platform Agent Experience

Build the unified agent layer that makes all three platforms feel seamless.

- [ ] Unified "AR glasses" channel that auto-detects whichever device is connected
- [ ] Context-aware agent system prompt: "You are wearing {device}, you can {capabilities}"
- [ ] Multimodal pipeline: camera frame → vision LLM → response → display/speak
- [ ] Proactive mode: agent uses OpenClaw heartbeat/cron to push info (weather, reminders, navigation) to HUD
- [ ] Multi-device support: connect multiple glasses simultaneously, route messages to the right one
- [ ] Voice activation flow: wake word → mic capture → STT → agent → response → HUD/speaker
- [ ] Conversation memory: agent remembers what it saw through the camera across sessions
- [ ] Privacy controls: configurable camera/mic access policies, local-only processing mode

---

### Phase 9 — Testing, Docs & Community

Harden everything and make it easy for others to contribute.

- [ ] Unit tests for all three plugins (mocked hardware)
- [ ] Integration tests with Mock Device Kit (Meta) and BLE simulator (Even G2)
- [ ] End-to-end demo video for each platform
- [ ] Developer quickstart guide for each companion app
- [ ] WebSocket protocol specification document (for companion app implementers)
- [ ] OpenClaw skill registry submission (publish plugins to ClawHub)
- [ ] npm package publishing (`@ar-openclaw/even-g2`, `@ar-openclaw/rokid`, `@ar-openclaw/meta-raybans`)
- [ ] Community Discord / GitHub Discussions setup
- [ ] Security audit: review camera/mic permission model, data-in-transit encryption
- [ ] Performance benchmarks: latency from voice input to HUD response per platform

---

## Supported Devices

| Device | Display | Camera | Mic | Connection | Plugin Status |
|--------|---------|--------|-----|------------|---------------|
| **Even Realities G2** | Micro-LED waveguide (488px) | - | Yes (LC3) | BLE 5.4 (dual-channel) | Alpha |
| **Rokid Glasses** | Dual Micro-LED (23deg FOV) | 12MP | Yes | Android companion app | Alpha |
| **Meta Ray-Bans** | HUD (Gen 3+) | 12MP ultra-wide | 5-mic array | Device Access Toolkit (iOS/Android) | Alpha |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                       │
│  (agent runtime, LLM routing, tool execution, sessions)  │
├──────────┬───────────┬───────────┬───────────────────────┤
│  Plugin  │  Plugin   │  Plugin   │  ... other plugins    │
│  even-g2 │  rokid    │  meta-rb  │                       │
├──────────┴───────────┴───────────┴───────────────────────┤
│               @ar-openclaw/shared                        │
│   (common types, image utils, text layout, AR helpers)   │
└──────────┬───────────┬───────────┬───────────────────────┘
           │           │           │
     BLE 5.4     Android SDK    Meta DAT SDK
     (Node)      (companion)    (iOS/Android)
           │           │           │
    ┌──────┴──┐  ┌─────┴───┐  ┌───┴──────┐
    │ Even G2 │  │  Rokid   │  │ Meta     │
    │ Glasses │  │ Glasses  │  │ Ray-Bans │
    └─────────┘  └─────────┘  └──────────┘
```

Each plugin registers two integration slots with OpenClaw:

1. **Channel** -- receives inbound messages from the glasses (voice via mic, touch gestures, camera frames) and sends outbound messages back (text to HUD, audio playback, image overlays).
2. **Tool** -- exposes glasses capabilities as agent tools so the LLM can decide when to look through the camera, display information, or listen to ambient audio.

## Directory Layout

```
AR-Native-OpenClaw/
├── shared/                    # Common types & utilities
│   ├── src/
│   │   ├── types.ts           # Cross-platform AR types
│   │   ├── text-layout.ts     # Text fitting for small displays
│   │   └── image-utils.ts     # Image conversion helpers
│   └── package.json
│
├── even-realities-g2/         # Even Realities G2 plugin
│   ├── src/
│   │   ├── index.ts           # Plugin entry (register)
│   │   ├── ble/               # BLE connection & protocol
│   │   ├── channel.ts         # OpenClaw channel adapter
│   │   └── tools.ts           # Agent tools (display, mic)
│   └── package.json
│
├── rokid/                     # Rokid Glasses plugin
│   ├── src/
│   │   ├── index.ts           # Plugin entry (register)
│   │   ├── companion/         # Android companion bridge
│   │   ├── channel.ts         # OpenClaw channel adapter
│   │   └── tools.ts           # Agent tools (camera, display)
│   └── package.json
│
├── meta-raybans/              # Meta Ray-Ban plugin
│   ├── src/
│   │   ├── index.ts           # Plugin entry (register)
│   │   ├── dat/               # Device Access Toolkit bridge
│   │   ├── channel.ts         # OpenClaw channel adapter
│   │   └── tools.ts           # Agent tools (camera, audio)
│   └── package.json
│
├── package.json               # Workspace root
└── tsconfig.json              # Shared TS config
```

## Quick Start

```bash
# Clone
git clone https://github.com/SamuelrSun/AR-Native-OpenClaw.git
cd AR-Native-OpenClaw

# Install
pnpm install

# Build all plugins
pnpm build

# Install a plugin into your OpenClaw instance (e.g. Even G2)
openclaw plugins install -l ./even-realities-g2
```

Then add the plugin config to `~/.openclaw/openclaw.json`:

```jsonc
{
  "extensions": {
    "ar-openclaw-even-g2": {
      "enabled": true,
      "glasses_name": "My G2"       // BLE advertised name
    }
  }
}
```

## Integration Approach Per Device

### Even Realities G2

The G2 communicates over **BLE 5.4 with a dual-channel architecture** (left arm + right arm). The plugin uses Noble (Node.js BLE library) to:

- Connect and authenticate via a 7-packet handshake
- Send text to the HUD via command `0x4E` (488px width, 21pt font, 5 lines/screen)
- Send 1-bit BMP images (576x136px) via command `0x15`
- Receive voice input from the mic (LC3 audio via `0xF1`) after enabling with `0x0E`
- Handle touch gestures from the TouchBar via `0xF5` events

Two BLE service channels are used:
- **Content Channel (0x5401):** data transmission (text, events)
- **Rendering Channel (0x6402):** display formatting and positioning

### Rokid Glasses

Rokid runs a full **Android-based OS** on the glasses with an open SDK. The plugin bridges via a lightweight companion Android app that:

- Exposes a WebSocket server on the local network
- Proxies camera frames (12MP), mic audio, and display commands between the glasses and the OpenClaw gateway
- Uses Rokid's UXR SDK for rendering AR overlays
- Supports the Rokid AR1 chip's on-device AI inference

The companion app approach means the OpenClaw gateway communicates over WebSocket/HTTP rather than direct hardware protocols.

### Meta Ray-Bans

Meta provides the **Wearables Device Access Toolkit (DAT)** as a native iOS/Android SDK. The plugin bridges via a companion mobile app that:

- Connects to the glasses using the DAT SDK (`mwdat-core`, `mwdat-camera`)
- Streams camera frames and mic audio to the OpenClaw gateway over WebSocket
- Processes AI inference either locally or via the OpenClaw gateway's LLM
- Sends audio responses back to the glasses' open-ear speakers

Current DAT limitations: no HUD display access (Gen 1/2), no Meta AI integration, no Neural Band gestures. The plugin focuses on camera + audio I/O and routes all AI through OpenClaw's own model pipeline.

## Development

```bash
# Dev mode with hot reload
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint

# Build single plugin
pnpm --filter @ar-openclaw/even-g2 build
```

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
