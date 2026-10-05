import { Channel } from '../common/channel';
import { countSmsSegments, MAX_SMS_SEGMENTS, replyViolation } from './channel-rules';

describe('countSmsSegments', () => {
  it.each([
    ['', 'GSM-7', 1],
    ['a'.repeat(160), 'GSM-7', 1],
    ['a'.repeat(161), 'GSM-7', 2],
    ['a'.repeat(306), 'GSM-7', 2],
    ['a'.repeat(307), 'GSM-7', 3],
    ['Merci, à bientôt', 'UCS-2', 1], // "ô" is not in the GSM set
    ['é'.repeat(160), 'GSM-7', 1], // but "é" is
    ['ô'.repeat(70), 'UCS-2', 1],
    ['ô'.repeat(71), 'UCS-2', 2],
  ])('%#: %s chars of text → %s, %d segment(s)', (text, encoding, segments) => {
    expect(countSmsSegments(text)).toEqual({ encoding, segments });
  });

  it('counts extension characters twice', () => {
    expect(countSmsSegments('€'.repeat(80)).segments).toBe(1);
    expect(countSmsSegments('€'.repeat(81)).segments).toBe(2);
  });

  it('counts an emoji as two UCS-2 units', () => {
    expect(countSmsSegments('👍'.repeat(35)).segments).toBe(1);
    expect(countSmsSegments('👍'.repeat(36)).segments).toBe(2);
  });
});

describe('replyViolation', () => {
  it('rejects empty replies on every channel', () => {
    for (const channel of Object.values(Channel)) {
      expect(replyViolation(channel, '   ')).toBe('Reply is empty');
    }
  });

  it('caps SMS replies by segment count', () => {
    expect(replyViolation(Channel.Sms, 'a'.repeat(153 * MAX_SMS_SEGMENTS))).toBeNull();
    expect(replyViolation(Channel.Sms, 'a'.repeat(153 * MAX_SMS_SEGMENTS + 1))).toMatch(
      /7 GSM-7 segments/,
    );
  });

  it('caps WhatsApp replies at 4096 characters', () => {
    expect(replyViolation(Channel.WhatsApp, 'a'.repeat(4096))).toBeNull();
    expect(replyViolation(Channel.WhatsApp, 'a'.repeat(4097))).toMatch(/4096/);
  });

  it('accepts long emails', () => {
    expect(replyViolation(Channel.Email, 'a'.repeat(10_000))).toBeNull();
  });
});
