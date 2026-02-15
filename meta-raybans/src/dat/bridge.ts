/**
 * WebSocket bridge to the Meta Ray-Ban companion app.
 *
 * The companion app runs on iOS or Android and wraps Meta's
 * Wearables Device Access Toolkit (DAT), which provides:
 *   - mwdat-core: base connectivity and pairing
 *   - mwdat-camera: 12MP ultra-wide camera streaming & capture
 *   - Bluetooth profiles: 5-mic array and open-ear speakers
 *
 * The bridge relays camera frames, mic audio, and speaker output
 * between the companion and the OpenClaw gateway.
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type {
  ConnectionState,
  ARDevice,
  DevicePlatform,
} from "@ar-openclaw/shared";

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface DATCommand {
  type:
    | "capture_photo"
    | "start_camera_stream"
    | "stop_camera_stream"
    | "start_mic"
    | "stop_mic"
    | "play_audio"
    | "speak"; // TTS via companion app
  payload?: Record<string, unknown>;
}

export interface DATEvent {
  type:
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

export interface DATBridgeOptions {
  host: string;
  port: number;
  autoReconnect: boolean;
  reconnectIntervalMs: number;
  glassesName: string;
  ttsEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

export class MetaDATBridge extends EventEmitter {
  private state: ConnectionState = "disconnected";
  private ws: WebSocket | null = null;
  private options: DATBridgeOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: DATBridgeOptions) {
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
      platform: "meta-raybans" as DevicePlatform,
      name: this.options.glassesName,
      connected: this.isConnected(),
      capabilities: {
        // Meta Ray-Bans Gen 1/2 have no developer-accessible HUD.
        // Gen 3 (Ray-Ban Display) has a HUD but DAT doesn't support it yet.
        camera: {
          resolutionMp: 12,
          supportsVideoStream: true,
          supportsPhotoCapture: true,
        },
        audio: {
          micCount: 5,
          hasSpeakers: true,
          micCodec: "AAC",
        },
        hasTouchInput: false, // DAT doesn't expose touch/gestures
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
  // Commands
  // -----------------------------------------------------------------------

  async sendCommand(cmd: DATCommand): Promise<void> {
    this.ensureConnected();
    this.ws!.send(JSON.stringify(cmd));
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

  /**
   * Text-to-speech: the companion app converts text to audio and plays it
   * through the Ray-Bans' open-ear speakers.
   */
  async speak(text: string): Promise<void> {
    await this.sendCommand({
      type: "speak",
      payload: { text },
    });
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit("stateChange", {
      state,
      device: "meta-raybans",
      timestamp: Date.now(),
    });
  }

  private ensureConnected(): void {
    if (!this.ws || this.state !== "connected") {
      throw new Error(
        `Meta Ray-Ban companion not connected (state: ${this.state})`,
      );
    }
  }

  private handleMessage(data: WebSocket.Data, isBinary: boolean): void {
    if (isBinary) {
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

    try {
      const event: DATEvent = JSON.parse(data.toString());
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
