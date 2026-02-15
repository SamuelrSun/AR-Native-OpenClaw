/**
 * OpenClaw agent tools for the Even Realities G2.
 *
 * These tools let the LLM decide when to show text, display images,
 * or listen through the G2's microphone.
 */

import type { EvenG2Connection } from "./ble/connection.js";
import type { EvenG2Config } from "./index.js";
import { layoutText, rgbaTo1BitBmp, splitBmpIntoPackets } from "@ar-openclaw/shared";

export function registerTools(
  api: any,
  connection: EvenG2Connection,
  config: EvenG2Config,
): void {
  const fontSizePt = config.display?.font_size_pt ?? 21;
  const linesPerScreen = config.display?.lines_per_screen ?? 5;

  // -------------------------------------------------------------------------
  // Display text
  // -------------------------------------------------------------------------
  api.registerTool("even_g2_display_text", {
    description:
      "Display text on the Even Realities G2 smart glasses HUD. " +
      "Long text is automatically paginated for the small display. " +
      "Use this to show the user information hands-free.",
    input: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to display on the glasses",
        },
      },
      required: ["text"],
    },
    async execute({ text }: { text: string }) {
      const screens = layoutText(text, {
        fontSizePt,
        linesPerScreen,
        display: connection.getDeviceInfo().capabilities.display!,
      });

      for (const screen of screens) {
        await connection.sendText(screen.lines.join("\n"));
      }

      return { success: true, screens: screens.length };
    },
  });

  // -------------------------------------------------------------------------
  // Display image
  // -------------------------------------------------------------------------
  api.registerTool("even_g2_display_image", {
    description:
      "Display a monochrome image on the Even G2 HUD. " +
      "Accepts base64-encoded RGBA image data. " +
      "Image will be resized and dithered to 576x136 1-bit.",
    input: {
      type: "object",
      properties: {
        image_base64: {
          type: "string",
          description: "Base64-encoded RGBA image data",
        },
        width: {
          type: "number",
          description: "Source image width in pixels",
        },
        height: {
          type: "number",
          description: "Source image height in pixels",
        },
      },
      required: ["image_base64", "width", "height"],
    },
    async execute({
      image_base64,
      width,
      height,
    }: {
      image_base64: string;
      width: number;
      height: number;
    }) {
      const rgba = Buffer.from(image_base64, "base64");
      const bmp = rgbaTo1BitBmp(rgba, width, height);
      const packets = splitBmpIntoPackets(bmp);
      await connection.sendImagePackets(packets);
      return { success: true, packets: packets.length };
    },
  });

  // -------------------------------------------------------------------------
  // Clear display
  // -------------------------------------------------------------------------
  api.registerTool("even_g2_clear_display", {
    description: "Clear the Even G2 smart glasses HUD display.",
    input: { type: "object", properties: {} },
    async execute() {
      await connection.clearDisplay();
      return { success: true };
    },
  });

  // -------------------------------------------------------------------------
  // Microphone control
  // -------------------------------------------------------------------------
  api.registerTool("even_g2_start_listening", {
    description:
      "Enable the Even G2 microphone to capture audio. " +
      "Audio will be streamed as LC3 and transcribed by OpenClaw.",
    input: { type: "object", properties: {} },
    async execute() {
      await connection.enableMicrophone();
      return { success: true, codec: "LC3" };
    },
  });

  api.registerTool("even_g2_stop_listening", {
    description: "Disable the Even G2 microphone.",
    input: { type: "object", properties: {} },
    async execute() {
      await connection.disableMicrophone();
      return { success: true };
    },
  });
}
