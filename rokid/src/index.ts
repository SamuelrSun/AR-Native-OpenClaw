/**
 * OpenClaw plugin entry point for Rokid AR Glasses.
 *
 * Communicates with the glasses via a companion Android app that exposes
 * a WebSocket server bridging the Rokid UXR SDK to this plugin.
 */

import { createChannel } from "./channel.js";
import { registerTools } from "./tools.js";
import { RokidCompanionBridge } from "./companion/bridge.js";

export interface RokidConfig {
  enabled: boolean;
  glasses_name?: string;
  companion_host?: string;
  companion_port?: number;
  auto_reconnect?: boolean;
  reconnect_interval_ms?: number;
}

export default function register(api: any): void {
  const config: RokidConfig = api.config ?? {};
  if (config.enabled === false) return;

  const bridge = new RokidCompanionBridge({
    host: config.companion_host ?? "localhost",
    port: config.companion_port ?? 9820,
    autoReconnect: config.auto_reconnect ?? true,
    reconnectIntervalMs: config.reconnect_interval_ms ?? 3000,
    glassesName: config.glasses_name ?? "Rokid Glasses",
  });

  const channel = createChannel(bridge, config);
  api.registerChannel(channel);

  registerTools(api, bridge);

  api.registerGatewayMethod(
    "ar-openclaw-rokid.status",
    ({ respond }: { respond: (ok: boolean, data: unknown) => void }) => {
      respond(true, {
        connected: bridge.isConnected(),
        state: bridge.getState(),
        device: bridge.getDeviceInfo(),
      });
    },
  );

  api.log?.info("[rokid] Plugin registered");
}
