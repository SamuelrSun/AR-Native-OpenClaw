# AR-Native-OpenClaw

OpenClaw plugins for AR smart glasses. Run your personal AI assistant hands-free on Even Realities G2, Rokid Glasses, and Meta Ray-Bans.

Each directory contains a standalone OpenClaw plugin that bridges the glasses' hardware (display, camera, microphone) into the OpenClaw agent runtime so the assistant can see what you see, hear what you hear, and show you information in your field of view.

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
