/**
 * Cross-platform types for AR glasses integration with OpenClaw.
 */

// ---------------------------------------------------------------------------
// Device capabilities
// ---------------------------------------------------------------------------

export interface DisplayCapabilities {
  /** Horizontal resolution in pixels */
  widthPx: number;
  /** Vertical resolution in pixels */
  heightPx: number;
  /** Whether the display supports images (not just text) */
  supportsImages: boolean;
  /** Bits per pixel (1 for monochrome, 24 for full color, etc.) */
  colorDepth: number;
  /** Maximum brightness in nits, if known */
  maxBrightnessNits?: number;
}

export interface CameraCapabilities {
  /** Resolution in megapixels */
  resolutionMp: number;
  /** Whether live video streaming is supported */
  supportsVideoStream: boolean;
  /** Whether single photo capture is supported */
  supportsPhotoCapture: boolean;
}

export interface AudioCapabilities {
  /** Number of microphones */
  micCount: number;
  /** Whether the device has speakers */
  hasSpeakers: boolean;
  /** Audio codec used for mic streaming (e.g. "LC3", "AAC", "PCM") */
  micCodec?: string;
}

export interface DeviceCapabilities {
  display?: DisplayCapabilities;
  camera?: CameraCapabilities;
  audio?: AudioCapabilities;
  /** Whether the device supports touch/gesture input */
  hasTouchInput: boolean;
}

// ---------------------------------------------------------------------------
// Device descriptors
// ---------------------------------------------------------------------------

export type DevicePlatform = "even-g2" | "rokid" | "meta-raybans";

export interface ARDevice {
  platform: DevicePlatform;
  name: string;
  capabilities: DeviceCapabilities;
  /** Whether the device is currently connected */
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Messages flowing between glasses and OpenClaw
// ---------------------------------------------------------------------------

export type InboundMessageType =
  | "voice"       // mic audio chunk
  | "gesture"     // touch / tap / swipe
  | "photo"       // single camera frame
  | "video_frame" // streaming video frame
  | "text"        // transcribed speech or typed text
  | "event";      // device lifecycle (connect, disconnect, battery, etc.)

export interface InboundMessage {
  type: InboundMessageType;
  device: DevicePlatform;
  timestamp: number;
  payload: Buffer | string | Record<string, unknown>;
}

export type OutboundMessageType =
  | "text"   // display text on HUD
  | "image"  // display image on HUD
  | "audio"  // play audio through speakers
  | "clear"; // clear the display

export interface OutboundMessage {
  type: OutboundMessageType;
  device: DevicePlatform;
  payload: Buffer | string | Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Plugin configuration (base shared across all AR plugins)
// ---------------------------------------------------------------------------

export interface ARPluginConfig {
  /** Human-readable name for the glasses instance */
  glasses_name?: string;
  /** Whether to auto-reconnect on disconnect */
  auto_reconnect?: boolean;
  /** Reconnect interval in ms */
  reconnect_interval_ms?: number;
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

export type ConnectionState =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

export interface ConnectionEvent {
  state: ConnectionState;
  device: DevicePlatform;
  error?: string;
  timestamp: number;
}
