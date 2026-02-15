/**
 * Helpers for converting images into formats accepted by AR glasses displays.
 *
 * Even G2 requires 1-bit BMP at 576x136.
 * Rokid accepts standard image formats via its Android rendering pipeline.
 * Meta Ray-Bans do not yet expose HUD image display (DAT limitation).
 */

/** 1-bit BMP dimensions required by the Even G2 */
export const EVEN_G2_BMP_WIDTH = 576;
export const EVEN_G2_BMP_HEIGHT = 136;

/**
 * Convert raw RGBA pixel data to a 1-bit BMP buffer suitable for the Even G2.
 *
 * Input: RGBA buffer with dimensions `width` x `height`.
 * Output: 1-bit BMP (576x136) with standard BMP headers.
 *
 * If the input dimensions differ from 576x136, a nearest-neighbor resize is
 * performed first.  Pixels are thresholded at 50% luminance.
 */
export function rgbaTo1BitBmp(
  rgba: Buffer,
  width: number,
  height: number,
): Buffer {
  // Resize to target dimensions using nearest-neighbor
  const resized = nearestNeighborResize(
    rgba,
    width,
    height,
    EVEN_G2_BMP_WIDTH,
    EVEN_G2_BMP_HEIGHT,
  );

  const rowBytes = Math.ceil(EVEN_G2_BMP_WIDTH / 8);
  // BMP rows are padded to 4-byte boundaries
  const paddedRowBytes = Math.ceil(rowBytes / 4) * 4;
  const pixelDataSize = paddedRowBytes * EVEN_G2_BMP_HEIGHT;

  // BMP file header (14 bytes) + DIB header (40 bytes) + color table (8 bytes)
  const headerSize = 14 + 40 + 8;
  const fileSize = headerSize + pixelDataSize;
  const bmp = Buffer.alloc(fileSize);

  // -- BMP file header --
  bmp.write("BM", 0);                         // signature
  bmp.writeUInt32LE(fileSize, 2);              // file size
  bmp.writeUInt32LE(0, 6);                     // reserved
  bmp.writeUInt32LE(headerSize, 10);           // pixel data offset

  // -- DIB header (BITMAPINFOHEADER) --
  bmp.writeUInt32LE(40, 14);                   // header size
  bmp.writeInt32LE(EVEN_G2_BMP_WIDTH, 18);     // width
  bmp.writeInt32LE(EVEN_G2_BMP_HEIGHT, 22);    // height (positive = bottom-up)
  bmp.writeUInt16LE(1, 26);                    // color planes
  bmp.writeUInt16LE(1, 28);                    // bits per pixel
  bmp.writeUInt32LE(0, 30);                    // compression (none)
  bmp.writeUInt32LE(pixelDataSize, 34);        // image data size
  bmp.writeInt32LE(2835, 38);                  // horizontal resolution (72 DPI)
  bmp.writeInt32LE(2835, 42);                  // vertical resolution
  bmp.writeUInt32LE(2, 46);                    // colors in palette
  bmp.writeUInt32LE(0, 50);                    // important colors

  // -- Color table (black and white) --
  // Color 0: black (B,G,R,A)
  bmp.writeUInt32LE(0x00000000, 54);
  // Color 1: white
  bmp.writeUInt32LE(0x00FFFFFF, 58);

  // -- Pixel data (bottom-up row order) --
  for (let y = 0; y < EVEN_G2_BMP_HEIGHT; y++) {
    const srcY = EVEN_G2_BMP_HEIGHT - 1 - y; // BMP is bottom-up
    for (let x = 0; x < EVEN_G2_BMP_WIDTH; x++) {
      const srcIdx = (srcY * EVEN_G2_BMP_WIDTH + x) * 4;
      const r = resized[srcIdx];
      const g = resized[srcIdx + 1];
      const b = resized[srcIdx + 2];
      // Luminance threshold at 128
      const bit = (0.299 * r + 0.587 * g + 0.114 * b) >= 128 ? 1 : 0;

      const byteIdx = headerSize + y * paddedRowBytes + Math.floor(x / 8);
      const bitPos = 7 - (x % 8);
      if (bit) {
        bmp[byteIdx] |= 1 << bitPos;
      }
    }
  }

  return bmp;
}

/**
 * Nearest-neighbor resize of RGBA buffer.
 */
function nearestNeighborResize(
  src: Buffer,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Buffer {
  if (srcW === dstW && srcH === dstH) return src;

  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.floor(y * yRatio);
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}

/**
 * Split a BMP buffer into fixed-size packets for BLE transmission.
 * Used by the Even G2 protocol (command 0x15, 194-byte payload per packet).
 */
export function splitBmpIntoPackets(
  bmpData: Buffer,
  packetPayloadSize: number = 194,
): Buffer[] {
  const packets: Buffer[] = [];
  for (let offset = 0; offset < bmpData.length; offset += packetPayloadSize) {
    packets.push(bmpData.subarray(offset, offset + packetPayloadSize));
  }
  return packets;
}
