/**
 * WebSocket bridge to the Rokid companion Android app.
 *
 * The companion app runs on the Rokid glasses (or connected phone/dock)
 * and exposes the UXR SDK capabilities over a local WebSocket server.
 *
 * Protocol:
 *   - JSON messages for commands and events
 *   - Binary messages for camera frames and audio data
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type {
  ConnectionState,
  ARDevice,
  DevicePlatform,
} from "@ar-openclaw/shared";

// ---------------------------------------------------------------------------
// Message types between the plugin and companion app
// ---------------------------------------------------------------------------

export interface CompanionCommand {
  type:
    | "display_text"
    | "display_image"
    | "clear_display"
    | "capture_photo"
    | "start_camera_stream"
    | "stop_camera_stream"
    | "start_mic"
    | "stop_mic"
    | "play_audio";
  payload?: Record<string, unknown>;
}

export interface CompanionEvent {
  type:
    | "gesture"
    | "photo"
    | "video_frame"
    | "audio_chunk"
    | "transcription"
    | "device_status";
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bridge options
// ---------------------------------------------------------------------------

export interface BridgeOptions {
  host: string;
  port: number;
  autoReconnect: boolean;
  reconnectIntervalMs: number;
  glassesName: string;
}

// ---------------------------------------------------------------------------
// Bridge implementation
// ---------------------------------------------------------------------------

export class RokidCompanionBridge extends EventEmitter {
  private state: ConnectionState = "disconnected";
  private ws: WebSocket | null = null;
  private options: BridgeOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: BridgeOptions) {
    super();
    this.options = options;
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  getDeviceInfo(): ARDevice {
    return {
      platform: "rokid" as DevicePlatform,
      name: this.options.glassesName,
      connected: this.isConnected(),
      capabilities: {
        display: {
          widthPx: 1280,
          heightPx: 480,
          supportsImages: true,
          colorDepth: 24,
          maxBrightnessNits: 1500,
        },
        camera: {
          resolutionMp: 12,
          supportsVideoStream: true,
          supportsPhotoCapture: true,
        },
        audio: {
          micCount: 2,
          hasSpeakers: true,
          micCodec: "PCM",
        },
        hasTouchInput: true,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") return;

    this.setState("connecting");
    const url = `ws://${this.options.host}:${this.options.port}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        this.setState("connected");
        this.emit("connected");
      });

      this.ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
        this.handleMessage(data, isBinary);
      });

      this.ws.on("close", () => {
        this.ws = null;
        this.setState("disconnected");
        this.emit("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err: Error) => {
        this.emit("error", err);
        // close handler will fire after this and handle reconnect
      });
    } catch (err) {
      this.setState("error");
      this.emit("error", err);
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("disconnected");
  }

  // -----------------------------------------------------------------------
  // Commands to the companion app
  // -----------------------------------------------------------------------

  async sendCommand(cmd: CompanionCommand): Promise<void> {
    this.ensureConnected();
    this.ws!.send(JSON.stringify(cmd));
  }

  async displayText(text: string): Promise<void> {
    await this.sendCommand({
      type: "display_text",
      payload: { text },
    });
  }

  async displayImage(imageBase64: string): Promise<void> {
    await this.sendCommand({
      type: "display_image",
      payload: { image: imageBase64 },
    });
  }

  async clearDisplay(): Promise<void> {
    await this.sendCommand({ type: "clear_display" });
  }

  async capturePhoto(): Promise<void> {
    await this.sendCommand({ type: "capture_photo" });
  }

  async startCameraStream(): Promise<void> {
    await this.sendCommand({ type: "start_camera_stream" });
  }

  async stopCameraStream(): Promise<void> {
    await this.sendCommand({ type: "stop_camera_stream" });
  }

  async startMicrophone(): Promise<void> {
    await this.sendCommand({ type: "start_mic" });
  }

  async stopMicrophone(): Promise<void> {
    await this.sendCommand({ type: "stop_mic" });
  }

  async playAudio(audioBase64: string): Promise<void> {
    await this.sendCommand({
      type: "play_audio",
      payload: { audio: audioBase64 },
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit("stateChange", {
      state,
      device: "rokid",
      timestamp: Date.now(),
    });
  }

  private ensureConnected(): void {
    if (!this.ws || this.state !== "connected") {
      throw new Error(`Rokid companion not connected (state: ${this.state})`);
    }
  }

  private handleMessage(data: WebSocket.Data, isBinary: boolean): void {
    if (isBinary) {
      // Binary messages are camera frames or audio chunks.
      // The first byte indicates the type: 0x01 = video, 0x02 = audio
      const buf = data as Buffer;
      if (buf.length < 2) return;

      const msgType = buf[0];
      const payload = buf.subarray(1);

      if (msgType === 0x01) {
        this.emit("video_frame", payload);
      } else if (msgType === 0x02) {
        this.emit("audio_chunk", payload);
      }
      return;
    }

    // JSON messages are events from the companion app
    try {
      const event: CompanionEvent = JSON.parse(data.toString());
      this.emit(event.type, event.payload);
    } catch {
      // Ignore malformed messages
    }
  }

  private scheduleReconnect(): void {
    if (!this.options.autoReconnect) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.options.reconnectIntervalMs);
  }
}
