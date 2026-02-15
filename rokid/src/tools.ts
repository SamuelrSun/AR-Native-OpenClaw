/**
 * OpenClaw agent tools for Rokid AR Glasses.
 *
 * Exposes camera, display, and audio capabilities as tools the LLM
 * can invoke during conversations.
 */

import type { RokidCompanionBridge } from "./companion/bridge.js";

export function registerTools(api: any, bridge: RokidCompanionBridge): void {
  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  api.registerTool("rokid_display_text", {
    description:
      "Display a text overlay on the Rokid AR Glasses. " +
      "The text appears as an AR overlay in the user's field of view.",
    input: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to display on the glasses",
        },
      },
      required: ["text"],
    },
    async execute({ text }: { text: string }) {
      await bridge.displayText(text);
      return { success: true };
    },
  });

  api.registerTool("rokid_display_image", {
    description:
      "Display an image overlay on the Rokid AR Glasses. " +
      "Accepts a base64-encoded image (PNG or JPEG).",
    input: {
      type: "object",
      properties: {
        image_base64: {
          type: "string",
          description: "Base64-encoded image data (PNG or JPEG)",
        },
      },
      required: ["image_base64"],
    },
    async execute({ image_base64 }: { image_base64: string }) {
      await bridge.displayImage(image_base64);
      return { success: true };
    },
  });

  api.registerTool("rokid_clear_display", {
    description: "Clear all overlays from the Rokid AR Glasses display.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.clearDisplay();
      return { success: true };
    },
  });

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  api.registerTool("rokid_capture_photo", {
    description:
      "Take a single photo with the Rokid Glasses 12MP camera. " +
      "Returns the image for analysis.",
    input: { type: "object", properties: {} },
    async execute() {
      // Request a photo from the companion app.
      // The companion will emit a 'photo' event when ready.
      await bridge.capturePhoto();
      return new Promise((resolve) => {
        bridge.once("photo", (payload: any) => {
          resolve({ success: true, image: payload.image });
        });
        // Timeout after 10s
        setTimeout(() => resolve({ success: false, error: "timeout" }), 10000);
      });
    },
  });

  api.registerTool("rokid_start_camera_stream", {
    description:
      "Start streaming video frames from the Rokid Glasses camera. " +
      "Frames will be available for real-time analysis.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.startCameraStream();
      return { success: true, streaming: true };
    },
  });

  api.registerTool("rokid_stop_camera_stream", {
    description: "Stop the Rokid Glasses camera video stream.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.stopCameraStream();
      return { success: true, streaming: false };
    },
  });

  // -------------------------------------------------------------------------
  // Audio
  // -------------------------------------------------------------------------

  api.registerTool("rokid_start_listening", {
    description:
      "Enable the Rokid Glasses microphone. Audio will be captured " +
      "and transcribed by the companion app.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.startMicrophone();
      return { success: true };
    },
  });

  api.registerTool("rokid_stop_listening", {
    description: "Disable the Rokid Glasses microphone.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.stopMicrophone();
      return { success: true };
    },
  });
}
