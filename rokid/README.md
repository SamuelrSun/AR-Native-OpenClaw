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

## References

- [Rokid AR Platform SDK](https://ar.rokid.com/sdk?lang=en) -- official SDK downloads
- [Rokid Glass 2 Docs](https://rokidglass.github.io/glass2-docs/en/) -- developer documentation
- [Rokid UXR SDK](https://github.com/RokidGlass/UXR-docs) -- Unity XR SDK docs
- [Rokid Developer Forum](https://developer-forum.rokid.com/) -- community support
