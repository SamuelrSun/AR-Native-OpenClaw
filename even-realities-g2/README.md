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

## References

- [Even Realities EvenDemoApp](https://github.com/even-realities/EvenDemoApp) -- official Flutter demo with protocol docs
- [even-g2-protocol](https://github.com/i-soxi/even-g2-protocol) -- community BLE reverse engineering
- [Even Hub Developer Portal](https://evenhub.evenrealities.com/) -- official SDK (early access)
