import type { DisplayCapabilities } from "./types.js";

/**
 * Approximate character width at a given font size in pixels.
 * This is a rough heuristic -- actual rendering depends on the font loaded
 * on the glasses firmware.  Values here assume a monospace-ish Latin font.
 */
function approxCharWidthPx(fontSizePt: number): number {
  // Empirical ratio from Even G2 demo app: 488px / ~23 chars at 21pt
  return fontSizePt * 1.01;
}

export interface TextLayoutOptions {
  fontSizePt: number;
  linesPerScreen: number;
  display: DisplayCapabilities;
}

export interface TextScreen {
  lines: string[];
}

/**
 * Break a long string into screens that fit the glasses' display.
 *
 * Each screen contains at most `linesPerScreen` lines, and each line is
 * word-wrapped to fit within `display.widthPx` at the given font size.
 */
export function layoutText(
  text: string,
  opts: TextLayoutOptions,
): TextScreen[] {
  const maxCharsPerLine = Math.floor(
    opts.display.widthPx / approxCharWidthPx(opts.fontSizePt),
  );

  const wrappedLines = wordWrap(text, maxCharsPerLine);

  const screens: TextScreen[] = [];
  for (let i = 0; i < wrappedLines.length; i += opts.linesPerScreen) {
    screens.push({
      lines: wrappedLines.slice(i, i + opts.linesPerScreen),
    });
  }

  return screens.length > 0 ? screens : [{ lines: [""] }];
}

/**
 * Simple word-wrap that respects existing newlines.
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const result: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      result.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += " " + word;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      result.push(currentLine);
    }
  }

  return result;
}
