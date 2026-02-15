# @ar-openclaw/even-g2

OpenClaw plugin for **Even Realities G2** smart glasses.

## How It Works

The G2 communicates over BLE 5.4 using a custom dual-channel protocol. This plugin uses [Noble](https://github.com/abandonware/noble) to manage the BLE connection directly from Node.js -- no companion app needed.

### Capabilities

| Feature | Status | Protocol |
|---------|--------|----------|
| Display text on HUD | Working | `0x4E` via Content Channel (0x5401) |
| Display images on HUD | Working | `0x15` (1-bit BMP, 576x136px) |
| Receive mic audio | Working | `0xF1` (LC3 codec) after `0x0E` enable |
| TouchBar gestures | Working | `0xF5` events |
| Even AI passthrough | Planned | Long-press activation flow |

### Connection Flow

1. Scan for BLE peripherals advertising the G2 service UUID
2. Connect to both left and right arms (dual BLE)
3. Perform 7-packet authentication handshake
4. Subscribe to notifications on Content Channel (0x5401) and Rendering Channel (0x6402)
5. Ready to send/receive

### Display Protocol

Text is sent via command `0x4E`:
- Display width: 488px
- Default font size: 21pt
- Lines per screen: 5
- Text is word-wrapped and paginated automatically by the plugin
- Multi-screen content uses automatic pagination with TouchBar manual override

Images are sent via command `0x15`:
- Format: 1-bit BMP, 576x136 pixels
- Packet size: 194 bytes per BLE packet
- Terminated with `[0x20, 0x0d, 0x0e]`
- Verified with CRC32-XZ checksum

### Packet Structure

```
[AA] [21] [seq] [len] [01] [01] [svc_hi] [svc_lo] [payload...] [crc_lo] [crc_hi]
```

- CRC-16/CCITT, init 0xFFFF, poly 0x1021, little-endian
- Calculated over payload bytes only (excluding 8-byte header)

## OpenClaw Integration

### Channel

The plugin registers as an OpenClaw **channel** so the agent can:
- Receive voice input transcribed from the G2's microphone
- Receive gesture events (tap, swipe, long-press) as control signals
- Send text responses that appear on the G2's HUD
- Send images rendered to the micro-LED display

### Tools

The plugin exposes these **agent tools**:

| Tool | Description |
|------|-------------|
| `even_g2_display_text` | Show text on the G2 HUD |
| `even_g2_display_image` | Show a 1-bit image on the G2 HUD |
| `even_g2_clear_display` | Clear the HUD |
| `even_g2_start_listening` | Enable the microphone |
| `even_g2_stop_listening` | Disable the microphone |

## Configuration

In `~/.openclaw/openclaw.json`:

```json
{
  "extensions": {
    "ar-openclaw-even-g2": {
      "enabled": true,
      "glasses_name": "Even G2",
      "auto_reconnect": true,
      "reconnect_interval_ms": 5000,
      "display": {
        "font_size_pt": 21,
        "lines_per_screen": 5
      }
    }
  }
}
```

---

## Roadmap

### Phase 1 — BLE Connectivity & Display

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

### Phase 2 — Microphone & Voice Input

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

### Phase 3 — Even AI Passthrough & Advanced Features

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

## References

- [Even Realities EvenDemoApp](https://github.com/even-realities/EvenDemoApp) -- official Flutter demo with protocol docs
- [even-g2-protocol](https://github.com/i-soxi/even-g2-protocol) -- community BLE reverse engineering
- [Even Hub Developer Portal](https://evenhub.evenrealities.com/) -- official SDK (early access)
