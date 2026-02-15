/**
 * OpenClaw agent tools for Meta Ray-Ban smart glasses.
 *
 * Focuses on camera and audio since the DAT doesn't expose HUD display.
 * The agent can see through the camera and speak to the user.
 */

import type { MetaDATBridge } from "./dat/bridge.js";

export function registerTools(api: any, bridge: MetaDATBridge): void {
  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  api.registerTool("meta_rb_capture_photo", {
    description:
      "Take a photo with the Meta Ray-Ban 12MP ultra-wide camera. " +
      "Returns the image for the agent to analyze.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.capturePhoto();
      return new Promise((resolve) => {
        bridge.once("photo", (payload: any) => {
          resolve({ success: true, image: payload.image });
        });
        setTimeout(() => resolve({ success: false, error: "timeout" }), 10000);
      });
    },
  });

  api.registerTool("meta_rb_start_camera_stream", {
    description:
      "Start streaming video frames from the Meta Ray-Ban camera. " +
      "Each frame can be analyzed in real-time for scene understanding.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.startCameraStream();
      return { success: true, streaming: true };
    },
  });

  api.registerTool("meta_rb_stop_camera_stream", {
    description: "Stop the Meta Ray-Ban camera video stream.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.stopCameraStream();
      return { success: true, streaming: false };
    },
  });

  // -------------------------------------------------------------------------
  // Audio
  // -------------------------------------------------------------------------

  api.registerTool("meta_rb_start_listening", {
    description:
      "Enable the Meta Ray-Ban 5-microphone array. " +
      "Captures ambient audio for transcription and analysis.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.startMicrophone();
      return { success: true, mics: 5 };
    },
  });

  api.registerTool("meta_rb_stop_listening", {
    description: "Disable the Meta Ray-Ban microphone array.",
    input: { type: "object", properties: {} },
    async execute() {
      await bridge.stopMicrophone();
      return { success: true };
    },
  });

  api.registerTool("meta_rb_play_audio", {
    description:
      "Play audio through the Meta Ray-Ban open-ear speakers. " +
      "Accepts base64-encoded audio data.",
    input: {
      type: "object",
      properties: {
        audio_base64: {
          type: "string",
          description: "Base64-encoded audio data",
        },
      },
      required: ["audio_base64"],
    },
    async execute({ audio_base64 }: { audio_base64: string }) {
      await bridge.playAudio(audio_base64);
      return { success: true };
    },
  });

  api.registerTool("meta_rb_speak", {
    description:
      "Convert text to speech and play it through the Meta Ray-Ban speakers. " +
      "Use this to give the user verbal information hands-free.",
    input: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to speak",
        },
      },
      required: ["text"],
    },
    async execute({ text }: { text: string }) {
      await bridge.speak(text);
      return { success: true };
    },
  });
}
