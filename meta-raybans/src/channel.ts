/**
 * OpenClaw channel adapter for Meta Ray-Ban smart glasses.
 *
 * Since the DAT doesn't expose a HUD, outbound text messages are
 * converted to speech and played through the glasses' speakers.
 * Inbound messages come from the camera and 5-mic array.
 */

import type { MetaDATBridge } from "./dat/bridge.js";
import type { MetaRayBansConfig } from "./index.js";

export function createChannel(bridge: MetaDATBridge, config: MetaRayBansConfig) {
  const ttsEnabled = config.tts_enabled ?? true;

  return {
    id: "ar-openclaw-meta-raybans",
    meta: {
      label: "Meta Ray-Bans",
      aliases: ["meta-raybans", "raybans", "ray-ban-meta"],
    },

    capabilities: {
      text: false,   // No HUD access via DAT
      images: false,  // No HUD access via DAT
      audio: true,    // 5-mic + open-ear speakers
      buttons: false,
    },

    config: {
      listAccountIds: async () => {
        const info = bridge.getDeviceInfo();
        return [info.name];
      },
      resolveAccount: async (id: string) => ({
        id,
        label: id,
        platform: "meta-raybans",
      }),
    },

    outbound: {
      deliveryMode: "push" as const,

      /**
       * "Send text" on Ray-Bans means speak it through the speakers,
       * since there's no developer-accessible HUD.
       */
      async sendText(accountId: string, text: string): Promise<void> {
        if (ttsEnabled) {
          await bridge.speak(text);
        }
      },

      async sendAudio(accountId: string, audioBase64: string): Promise<void> {
        await bridge.playAudio(audioBase64);
      },
    },

    async start(): Promise<void> {
      bridge.on("transcription", (payload: any) => {
        bridge.emit("inbound", {
          type: "text",
          device: "meta-raybans",
          timestamp: Date.now(),
          payload: payload.text,
        });
      });

      bridge.on("photo", (payload: any) => {
        bridge.emit("inbound", {
          type: "photo",
          device: "meta-raybans",
          timestamp: Date.now(),
          payload: payload.image,
        });
      });

      await bridge.connect();
    },

    async stop(): Promise<void> {
      await bridge.disconnect();
    },
  };
}
