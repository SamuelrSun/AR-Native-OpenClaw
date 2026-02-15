/**
 * OpenClaw plugin entry point for Meta Ray-Ban smart glasses.
 *
 * Uses the Wearables Device Access Toolkit (DAT) via a companion mobile app
 * that bridges camera, microphone, and speaker access to the OpenClaw gateway.
 */

import { createChannel } from "./channel.js";
import { registerTools } from "./tools.js";
import { MetaDATBridge } from "./dat/bridge.js";

export interface MetaRayBansConfig {
  enabled: boolean;
  glasses_name?: string;
  companion_host?: string;
  companion_port?: number;
  auto_reconnect?: boolean;
  reconnect_interval_ms?: number;
  /** Enable text-to-speech for outbound text messages */
  tts_enabled?: boolean;
}

export default function register(api: any): void {
  const config: MetaRayBansConfig = api.config ?? {};
  if (config.enabled === false) return;

  const bridge = new MetaDATBridge({
    host: config.companion_host ?? "localhost",
    port: config.companion_port ?? 9821,
    autoReconnect: config.auto_reconnect ?? true,
    reconnectIntervalMs: config.reconnect_interval_ms ?? 3000,
    glassesName: config.glasses_name ?? "Meta Ray-Bans",
    ttsEnabled: config.tts_enabled ?? true,
  });

  const channel = createChannel(bridge, config);
  api.registerChannel(channel);

  registerTools(api, bridge);

  api.registerGatewayMethod(
    "ar-openclaw-meta-raybans.status",
    ({ respond }: { respond: (ok: boolean, data: unknown) => void }) => {
      respond(true, {
        connected: bridge.isConnected(),
        state: bridge.getState(),
        device: bridge.getDeviceInfo(),
      });
    },
  );

  api.log?.info("[meta-raybans] Plugin registered");
}
