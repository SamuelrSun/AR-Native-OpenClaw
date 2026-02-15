/**
 * OpenClaw channel adapter for Rokid AR Glasses.
 *
 * Routes messages between the OpenClaw agent and the glasses via
 * the companion app WebSocket bridge.
 */

import type { RokidCompanionBridge } from "./companion/bridge.js";
import type { RokidConfig } from "./index.js";

export function createChannel(bridge: RokidCompanionBridge, config: RokidConfig) {
  return {
    id: "ar-openclaw-rokid",
    meta: {
      label: "Rokid Glasses",
      aliases: ["rokid", "rokid-glasses", "rokid-air"],
    },

    capabilities: {
      text: true,
      images: true,
      audio: true,
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
        platform: "rokid",
      }),
    },

    outbound: {
      deliveryMode: "push" as const,

      async sendText(accountId: string, text: string): Promise<void> {
        await bridge.displayText(text);
      },

      async sendImage(accountId: string, imageBase64: string): Promise<void> {
        await bridge.displayImage(imageBase64);
      },

      async sendAudio(accountId: string, audioBase64: string): Promise<void> {
        await bridge.playAudio(audioBase64);
      },
    },

    async start(): Promise<void> {
      // Forward companion events as OpenClaw channel inbound messages
      bridge.on("transcription", (payload: any) => {
        // The companion app uses on-device or cloud STT to transcribe mic audio.
        // Forward the text to the OpenClaw agent as a user message.
        bridge.emit("inbound", {
          type: "text",
          device: "rokid",
          timestamp: Date.now(),
          payload: payload.text,
        });
      });

      bridge.on("gesture", (payload: any) => {
        bridge.emit("inbound", {
          type: "gesture",
          device: "rokid",
          timestamp: Date.now(),
          payload,
        });
      });

      bridge.on("photo", (payload: any) => {
        bridge.emit("inbound", {
          type: "photo",
          device: "rokid",
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
