# @ar-openclaw/meta-raybans

OpenClaw plugin for **Meta Ray-Ban** smart glasses via the Wearables Device Access Toolkit (DAT).

## How It Works

Meta's DAT SDK is a native iOS/Android library -- apps for Ray-Ban glasses don't run on the glasses themselves. Instead, a mobile app accesses the glasses' sensors (camera, mic, speakers) through the DAT, processes data on the phone, and sends output back to the glasses.

This plugin follows the same companion app pattern as the Rokid plugin:

```
┌─────────────────┐         WebSocket          ┌─────────────────────┐
│  OpenClaw        │ ◄──────────────────────►  │  Meta RB Companion   │
│  Gateway         │    JSON messages +         │  App (iOS/Android)   │
│  (this plugin)   │    binary streams          │                      │
└─────────────────┘                            ├─────────────────────┤
                                               │  Meta Wearables DAT  │
                                               │  • mwdat-core        │
                                               │  • mwdat-camera      │
                                               │  • Bluetooth audio   │
                                               └────────┬────────────┘
                                                        │
                                                 ┌──────┴──────┐
                                                 │  Meta       │
                                                 │  Ray-Bans   │
                                                 └─────────────┘
```

### Why a Companion App?

The DAT SDK is only available as native Android (Kotlin/Gradle) and iOS (Swift) libraries. The companion app:

1. Pairs with the glasses through the Meta AI app (required by Meta)
2. Uses `mwdat-camera` to stream 12MP ultra-wide camera frames
3. Accesses the 5-mic array and open-ear speakers via iOS/Android Bluetooth profiles
4. Relays everything to the OpenClaw gateway over a local WebSocket

### Capabilities

| Feature | Status | Mechanism |
|---------|--------|-----------|
| Camera frames (12MP) | Working | DAT mwdat-camera -> WebSocket |
| Video streaming | Working | DAT mwdat-camera -> WebSocket |
| Microphone audio (5-mic) | Working | Bluetooth profile -> WebSocket |
| Speaker audio playback | Working | WebSocket -> Bluetooth profile |
| HUD display | Not available | DAT does not expose HUD (Gen 1/2) |
| Meta AI ("Hey Meta") | Not available | Not part of DAT |
| Neural Band gestures | Not available | Not part of DAT |

### Key Limitations

The DAT is in **developer preview** with significant constraints:

- **No HUD access**: The SDK cannot send images or text to the Ray-Ban Display. All visual output must go through audio responses instead.
- **No Meta AI**: "Hey Meta" invocations are separate from the DAT. This plugin routes all AI through OpenClaw's own LLM pipeline.
- **Publishing restricted**: Only select Meta partners can publish integrations publicly during the preview. Development and team testing is open.
- **Meta AI app required**: The glasses must be paired through Meta's AI app before the DAT can connect.

Because there's no HUD access, this plugin is primarily a **camera + audio bridge**: the agent sees what you see and speaks responses through the glasses' speakers.

## OpenClaw Integration

### Channel

The plugin registers as an OpenClaw channel:
- Inbound: camera frames, transcribed voice from the 5-mic array
- Outbound: audio responses played through open-ear speakers

### Tools

| Tool | Description |
|------|-------------|
| `meta_rb_capture_photo` | Take a photo with the 12MP ultra-wide camera |
| `meta_rb_start_camera_stream` | Begin streaming video frames |
| `meta_rb_stop_camera_stream` | Stop video streaming |
| `meta_rb_start_listening` | Enable the 5-microphone array |
| `meta_rb_stop_listening` | Disable the microphone |
| `meta_rb_play_audio` | Play audio through the open-ear speakers |
| `meta_rb_speak` | Convert text to speech and play on speakers |

## Configuration

In `~/.openclaw/openclaw.json`:

```json
{
  "extensions": {
    "ar-openclaw-meta-raybans": {
      "enabled": true,
      "glasses_name": "My Ray-Bans",
      "companion_host": "localhost",
      "companion_port": 9821,
      "auto_reconnect": true,
      "reconnect_interval_ms": 3000,
      "tts_enabled": true
    }
  }
}
```

## Companion App

Companion apps for both platforms are in `companion-app/`:

- `companion-app/android/` -- Android app using `mwdat-core` and `mwdat-camera`
- `companion-app/ios/` -- iOS app using the DAT Swift SDK

### Prerequisites

1. Meta AI app installed and glasses paired
2. Developer mode enabled on the glasses
3. DAT SDK access (apply at [developer.meta.com/wearables](https://developers.meta.com/wearables/))

### Android Build

```bash
cd companion-app/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### iOS Build

```bash
cd companion-app/ios
pod install
open MetaRBCompanion.xcworkspace
# Build and run from Xcode
```

---

## Roadmap

### Phase 1 — Companion App & DAT Integration

Build the iOS + Android companion apps wrapping Meta's Wearables Device Access Toolkit.

**1a. Android companion app (Kotlin)**
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

**1b. iOS companion app (Swift)**
- [ ] Xcode project scaffolding with DAT Swift SDK via CocoaPods
- [ ] Integrate DAT core for pairing and device lifecycle
- [ ] Camera capture and streaming via DAT
- [ ] Mic access via iOS Bluetooth audio profile
- [ ] Speaker output via iOS Bluetooth audio profile
- [ ] WebSocket server on phone (port 9821)
- [ ] Binary protocol for camera + audio streaming
- [ ] TTS via AVSpeechSynthesizer or cloud for `speak` command

**1c. Node.js plugin bridge**
- [x] `MetaDATBridge` class with WebSocket client, auto-reconnect, event routing
- [x] JSON + binary message protocol
- [ ] mDNS discovery for companion auto-detection
- [ ] Graceful reconnect with command buffering

**1d. OpenClaw plugin wiring**
- [x] Plugin entry point with channel + tools
- [x] Channel adapter (outbound via TTS since no HUD; inbound from camera + mic)
- [x] Agent tools: `meta_rb_capture_photo`, `meta_rb_start_camera_stream`, `meta_rb_stop_camera_stream`, `meta_rb_start_listening`, `meta_rb_stop_listening`, `meta_rb_play_audio`, `meta_rb_speak`
- [ ] Pipe inbound mic audio through shared STT adapter
- [ ] Pipe inbound camera frames to OpenClaw for multimodal LLM analysis
- [ ] End-to-end test: speak to Ray-Bans → hear LLM response through speakers

---

### Phase 2 — HUD & Future DAT Capabilities

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

## References

- [Meta Wearables Developer Portal](https://developers.meta.com/wearables/) -- SDK access and docs
- [Meta DAT Getting Started](https://wearables.developer.meta.com/docs/getting-started-toolkit/) -- setup guide
- [meta-wearables-dat-android](https://github.com/facebook/meta-wearables-dat-android) -- Android SDK and samples
- [Meta DAT Blog Post](https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/) -- overview
