/**
 * BLE connection manager for the Even Realities G2.
 *
 * Handles scanning, dual-arm connection, authentication handshake,
 * and provides send/receive primitives for the Content (0x5401) and
 * Rendering (0x6402) channels.
 *
 * Uses @abandonware/noble for cross-platform BLE from Node.js.
 */

import { EventEmitter } from "node:events";
import type {
  ConnectionState,
  ARDevice,
  DevicePlatform,
} from "@ar-openclaw/shared";
import { buildPacket, parsePacket, crc16ccitt } from "./protocol.js";

// BLE service and characteristic UUIDs (from reverse-engineered protocol)
const G2_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
const CONTENT_CHANNEL = 0x5401;
const RENDERING_CHANNEL = 0x6402;

export interface EvenG2ConnectionOptions {
  glassesName: string;
  autoReconnect: boolean;
  reconnectIntervalMs: number;
}

export class EvenG2Connection extends EventEmitter {
  private state: ConnectionState = "disconnected";
  private options: EvenG2ConnectionOptions;
  private peripheral: any = null; // noble peripheral
  private sequenceNumber = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: EvenG2ConnectionOptions) {
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
      platform: "even-g2" as DevicePlatform,
      name: this.options.glassesName,
      connected: this.isConnected(),
      capabilities: {
        display: {
          widthPx: 488,
          heightPx: 136,
          supportsImages: true,
          colorDepth: 1,
          maxBrightnessNits: 1500,
        },
        audio: {
          micCount: 1,
          hasSpeakers: false,
          micCodec: "LC3",
        },
        hasTouchInput: true,
      },
    };
  }

  /**
   * Start scanning for the G2 glasses and connect when found.
   */
  async connect(): Promise<void> {
    if (this.state !== "disconnected" && this.state !== "error") return;

    this.setState("scanning");

    // Dynamic import of noble to avoid issues when BLE is unavailable
    let noble: any;
    try {
      noble = (await import("@abandonware/noble")).default;
    } catch {
      this.setState("error");
      this.emit("error", new Error("BLE not available: @abandonware/noble could not be loaded"));
      return;
    }

    noble.on("discover", async (peripheral: any) => {
      const name = peripheral.advertisement?.localName ?? "";
      if (!name.includes(this.options.glassesName) && !name.includes("Even")) {
        return;
      }

      noble.stopScanning();
      this.peripheral = peripheral;
      this.setState("connecting");

      try {
        await this.connectToPeripheral(peripheral);
        await this.authenticate();
        this.setState("connected");
        this.setupNotifications();
        this.emit("connected");
      } catch (err) {
        this.setState("error");
        this.emit("error", err);
        this.scheduleReconnect();
      }
    });

    noble.on("stateChange", (bleState: string) => {
      if (bleState === "poweredOn") {
        noble.startScanning([G2_SERVICE_UUID], false);
      }
    });

    // If BLE is already powered on
    if (noble.state === "poweredOn") {
      noble.startScanning([G2_SERVICE_UUID], false);
    }
  }

  /**
   * Disconnect from the glasses.
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.peripheral) {
      try {
        await this.peripheral.disconnectAsync();
      } catch {
        // already disconnected
      }
      this.peripheral = null;
    }
    this.setState("disconnected");
    this.emit("disconnected");
  }

  // ---------------------------------------------------------------------------
  // Send commands
  // ---------------------------------------------------------------------------

  /**
   * Send a text payload to the G2 display (command 0x4E).
   */
  async sendText(text: string): Promise<void> {
    this.ensureConnected();
    const payload = Buffer.from(text, "utf-8");
    const packet = buildPacket(0x4e, CONTENT_CHANNEL, this.nextSeq(), payload);
    await this.writeToGlasses(packet);
  }

  /**
   * Send a 1-bit BMP image to the G2 display (command 0x15).
   * `packets` should come from splitBmpIntoPackets() in @ar-openclaw/shared.
   */
  async sendImagePackets(packets: Buffer[]): Promise<void> {
    this.ensureConnected();
    const syncId = this.nextSeq();

    for (const chunk of packets) {
      const header = Buffer.from([0x15, syncId]);
      const data = Buffer.concat([header, chunk]);
      await this.writeToGlasses(data);
    }

    // Termination sequence
    await this.writeToGlasses(Buffer.from([0x20, 0x0d, 0x0e]));
  }

  /**
   * Clear the display.
   */
  async clearDisplay(): Promise<void> {
    this.ensureConnected();
    // Send empty text to clear
    await this.sendText("");
  }

  /**
   * Enable the microphone (command 0x0E, payload 0x01).
   */
  async enableMicrophone(): Promise<void> {
    this.ensureConnected();
    const packet = buildPacket(0x0e, CONTENT_CHANNEL, this.nextSeq(), Buffer.from([0x01]));
    await this.writeToGlasses(packet);
  }

  /**
   * Disable the microphone (command 0x0E, payload 0x00).
   */
  async disableMicrophone(): Promise<void> {
    this.ensureConnected();
    const packet = buildPacket(0x0e, CONTENT_CHANNEL, this.nextSeq(), Buffer.from([0x00]));
    await this.writeToGlasses(packet);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private setState(state: ConnectionState): void {
    this.state = state;
    this.emit("stateChange", {
      state,
      device: "even-g2",
      timestamp: Date.now(),
    });
  }

  private nextSeq(): number {
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xff;
    return this.sequenceNumber;
  }

  private ensureConnected(): void {
    if (this.state !== "connected") {
      throw new Error(`G2 not connected (state: ${this.state})`);
    }
  }

  private async connectToPeripheral(peripheral: any): Promise<void> {
    await peripheral.connectAsync();

    peripheral.on("disconnect", () => {
      this.setState("disconnected");
      this.emit("disconnected");
      this.scheduleReconnect();
    });
  }

  /**
   * Perform the 7-packet authentication handshake.
   * The exact handshake packets are derived from the reverse-engineered protocol.
   */
  private async authenticate(): Promise<void> {
    this.setState("authenticating");
    // TODO: Implement full 7-packet handshake from even-g2-protocol docs.
    // For now this is a placeholder -- the actual handshake involves
    // exchanging challenge/response packets over the Content Channel.
  }

  private setupNotifications(): void {
    // Subscribe to BLE notifications from the glasses.
    // Route incoming packets to the appropriate handler based on command byte.
    // - 0xF5: TouchBar events
    // - 0xF1: Audio data (LC3)
    // - 0x4E: Text/AI result acknowledgements
  }

  private async writeToGlasses(data: Buffer): Promise<void> {
    if (!this.peripheral) throw new Error("No peripheral connected");
    // Write to the appropriate BLE characteristic.
    // The G2 uses dual-arm BLE -- send to left arm first, then right.
    // TODO: Discover and cache characteristic handles during connect.
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
