/**
 * OpenClaw plugin entry point for Even Realities G2 smart glasses.
 *
 * Registers a channel (for bidirectional messaging with the glasses) and
 * a set of tools (so the LLM agent can drive the display and microphone).
 */

import { createChannel } from "./channel.js";
import { registerTools } from "./tools.js";
import { EvenG2Connection } from "./ble/connection.js";

export interface EvenG2Config {
  enabled: boolean;
  glasses_name?: string;
  auto_reconnect?: boolean;
  reconnect_interval_ms?: number;
  display?: {
    font_size_pt?: number;
    lines_per_screen?: number;
  };
}

/**
 * Called by the OpenClaw gateway when the plugin is loaded.
 * `api` provides registration methods for channels, tools, and gateway RPCs.
 */
export default function register(api: any): void {
  const config: EvenG2Config = api.config ?? {};
  if (config.enabled === false) return;

  const connection = new EvenG2Connection({
    glassesName: config.glasses_name ?? "Even G2",
    autoReconnect: config.auto_reconnect ?? true,
    reconnectIntervalMs: config.reconnect_interval_ms ?? 5000,
  });

  // Register the channel adapter so OpenClaw can route messages to/from the glasses
  const channel = createChannel(connection, config);
  api.registerChannel(channel);

  // Register agent tools so the LLM can interact with the glasses
  registerTools(api, connection, config);

  // Expose a gateway RPC for status queries
  api.registerGatewayMethod(
    "ar-openclaw-even-g2.status",
    ({ respond }: { respond: (ok: boolean, data: unknown) => void }) => {
      respond(true, {
        connected: connection.isConnected(),
        state: connection.getState(),
        device: connection.getDeviceInfo(),
      });
    },
  );

  api.log?.info("[even-g2] Plugin registered");
}
