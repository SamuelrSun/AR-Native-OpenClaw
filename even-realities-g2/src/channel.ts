/**
 * OpenClaw channel adapter for the Even Realities G2.
 *
 * This translates between the G2's BLE events and OpenClaw's channel interface
 * so the agent can treat the glasses as a messaging surface.
 */

import { layoutText } from "@ar-openclaw/shared";
import type { EvenG2Connection } from "./ble/connection.js";
import type { EvenG2Config } from "./index.js";

/**
 * Create an OpenClaw channel plugin object for the G2.
 */
export function createChannel(connection: EvenG2Connection, config: EvenG2Config) {
  const fontSizePt = config.display?.font_size_pt ?? 21;
  const linesPerScreen = config.display?.lines_per_screen ?? 5;

  return {
    id: "ar-openclaw-even-g2",
    meta: {
      label: "Even G2",
      aliases: ["even-g2", "g2", "even-realities"],
    },

    capabilities: {
      text: true,
      images: true,
      audio: false, // G2 has no speakers -- audio is mic-only inbound
      buttons: false,
    },

    config: {
      /**
       * List paired glasses as "accounts" that OpenClaw can route to.
       */
      listAccountIds: async () => {
        const info = connection.getDeviceInfo();
        return [info.name];
      },

      resolveAccount: async (id: string) => ({
        id,
        label: id,
        platform: "even-g2",
      }),
    },

    outbound: {
      deliveryMode: "push" as const,

      /**
       * Send a text message to the G2 HUD.
       * Long text is automatically paginated for the display.
       */
      async sendText(accountId: string, text: string): Promise<void> {
        const screens = layoutText(text, {
          fontSizePt,
          linesPerScreen,
          display: connection.getDeviceInfo().capabilities.display!,
        });

        for (const screen of screens) {
          await connection.sendText(screen.lines.join("\n"));
          // Pause between screens so the user can read.
          // The agent or TouchBar "next" gesture can advance faster.
          if (screens.length > 1) {
            await sleep(3000);
          }
        }
      },

      /**
       * Send an image to the G2 HUD.
       * Expects raw image data; conversion to 1-bit BMP is handled upstream.
       */
      async sendImage(accountId: string, imageData: Buffer): Promise<void> {
        const { splitBmpIntoPackets } = await import("@ar-openclaw/shared");
        const packets = splitBmpIntoPackets(imageData);
        await connection.sendImagePackets(packets);
      },
    },

    /**
     * Called when the plugin starts -- initiate BLE connection.
     */
    async start(): Promise<void> {
      await connection.connect();
    },

    /**
     * Called when the plugin stops -- clean up BLE.
     */
    async stop(): Promise<void> {
      await connection.disconnect();
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
