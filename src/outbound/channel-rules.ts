import { Channel } from '../common/channel';

// GSM 03.38 basic set. Any other character forces the whole SMS into UCS-2.
const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
// Extension table: each of these costs two GSM characters.
const GSM_EXTENDED = new Set('^{}\\[~]|€\f');

export interface SmsSegments {
  encoding: 'GSM-7' | 'UCS-2';
  segments: number;
}

/** How many SMS a carrier will bill for this text. */
export function countSmsSegments(text: string): SmsSegments {
  const chars = Array.from(text);
  const isGsm = chars.every((c) => GSM_BASIC.has(c) || GSM_EXTENDED.has(c));
  if (isGsm) {
    const units = chars.reduce((n, c) => n + (GSM_EXTENDED.has(c) ? 2 : 1), 0);
    return { encoding: 'GSM-7', segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  // UCS-2 counts UTF-16 code units: an emoji takes two.
  const units = text.length;
  return { encoding: 'UCS-2', segments: units <= 70 ? 1 : Math.ceil(units / 67) };
}

export const MAX_SMS_SEGMENTS = 6;
export const MAX_WHATSAPP_LENGTH = 4096;

/** Returns why a reply cannot be sent on this channel, or null if it can. */
export function replyViolation(channel: Channel, body: string): string | null {
  if (body.trim().length === 0) {
    return 'Reply is empty';
  }
  switch (channel) {
    case Channel.Sms: {
      const { encoding, segments } = countSmsSegments(body);
      return segments > MAX_SMS_SEGMENTS
        ? `SMS would need ${segments} ${encoding} segments (max ${MAX_SMS_SEGMENTS})`
        : null;
    }
    case Channel.WhatsApp:
      return body.length > MAX_WHATSAPP_LENGTH
        ? `WhatsApp text is limited to ${MAX_WHATSAPP_LENGTH} characters`
        : null;
    case Channel.Email:
      return null;
  }
}
