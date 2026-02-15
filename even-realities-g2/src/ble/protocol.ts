/**
 * Even Realities G2 BLE packet protocol.
 *
 * Packet structure (from reverse-engineered docs):
 *   [AA] [21] [seq] [len] [01] [01] [svc_hi] [svc_lo] [payload...] [crc_lo] [crc_hi]
 *
 * - Header: 8 bytes (AA 21 seq len 01 01 svc_hi svc_lo)
 * - Payload: variable length
 * - CRC-16/CCITT: calculated over payload only, appended as little-endian
 *
 * Two service channels:
 *   Content Channel  (0x5401) -- text, events, microphone control
 *   Rendering Channel (0x6402) -- display formatting and positioning
 */

const CRC_INIT = 0xffff;
const CRC_POLY = 0x1021;
const PACKET_HEADER_MAGIC = 0xaa;
const PACKET_TYPE = 0x21;

/**
 * Compute CRC-16/CCITT over a buffer.
 * Polynomial: 0x1021, initial value: 0xFFFF.
 */
export function crc16ccitt(data: Buffer): number {
  let crc = CRC_INIT;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ CRC_POLY) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc;
}

/**
 * Build a BLE packet for the G2 protocol.
 *
 * @param command  - Command byte (e.g. 0x4E for text, 0x15 for image, 0x0E for mic)
 * @param channel  - Service channel (0x5401 or 0x6402)
 * @param seq      - Sequence number (0-255)
 * @param payload  - Command-specific payload
 */
export function buildPacket(
  command: number,
  channel: number,
  seq: number,
  payload: Buffer,
): Buffer {
  const fullPayload = Buffer.concat([Buffer.from([command]), payload]);
  const crc = crc16ccitt(fullPayload);

  const totalLen = 8 + fullPayload.length + 2; // header + payload + crc
  const packet = Buffer.alloc(totalLen);

  // Header
  packet[0] = PACKET_HEADER_MAGIC;
  packet[1] = PACKET_TYPE;
  packet[2] = seq & 0xff;
  packet.writeUInt16BE(fullPayload.length, 3); // length of payload
  packet[5] = 0x01;
  packet[6] = (channel >> 8) & 0xff;
  packet[7] = channel & 0xff;

  // Payload
  fullPayload.copy(packet, 8);

  // CRC (little-endian)
  const crcOffset = 8 + fullPayload.length;
  packet[crcOffset] = crc & 0xff;
  packet[crcOffset + 1] = (crc >> 8) & 0xff;

  return packet;
}

/**
 * Parse an incoming BLE packet from the G2.
 * Returns null if the packet is malformed or CRC doesn't match.
 */
export function parsePacket(
  data: Buffer,
): { command: number; channel: number; seq: number; payload: Buffer } | null {
  if (data.length < 10) return null; // minimum: 8 header + 0 payload + 2 crc
  if (data[0] !== PACKET_HEADER_MAGIC || data[1] !== PACKET_TYPE) return null;

  const seq = data[2];
  const payloadLen = data.readUInt16BE(3);
  const channel = (data[6] << 8) | data[7];

  if (data.length < 8 + payloadLen + 2) return null;

  const payloadWithCmd = data.subarray(8, 8 + payloadLen);
  const receivedCrc = data[8 + payloadLen] | (data[8 + payloadLen + 1] << 8);
  const computedCrc = crc16ccitt(payloadWithCmd);

  if (receivedCrc !== computedCrc) return null;

  const command = payloadWithCmd[0];
  const payload = payloadWithCmd.subarray(1);

  return { command, channel, seq, payload };
}

// ---------------------------------------------------------------------------
// Command constants
// ---------------------------------------------------------------------------

/** Text / AI result transmission */
export const CMD_TEXT = 0x4e;
/** BMP image data packet */
export const CMD_IMAGE = 0x15;
/** Packet transmission end */
export const CMD_END = 0x20;
/** CRC verification */
export const CMD_CRC = 0x16;
/** Microphone control (enable/disable) */
export const CMD_MIC = 0x0e;
/** Audio data stream (LC3 format) */
export const CMD_AUDIO = 0xf1;
/** TouchBar events and AI activation */
export const CMD_TOUCH = 0xf5;
