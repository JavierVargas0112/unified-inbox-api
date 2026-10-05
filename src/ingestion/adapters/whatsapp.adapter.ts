import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsArray } from 'class-validator';
import { Channel } from '../../common/channel';
import { toE164 } from '../../common/phone';
import { InboundMessage } from '../inbound-message';

/**
 * Envelope of the WhatsApp Cloud API webhook. Only the envelope is validated
 * here; the nested content varies by message type and is parsed defensively below.
 */
export class WhatsAppWebhookDto {
  @ApiProperty({ example: 'whatsapp_business_account' })
  @Equals('whatsapp_business_account')
  object: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  entry: unknown[];
}

interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
}

interface WaValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function changeValues(entry: unknown[]): WaValue[] {
  return entry
    .filter(isObject)
    .flatMap((e) => (Array.isArray(e.changes) ? (e.changes as unknown[]) : []))
    .filter(isObject)
    .map((c) => c.value)
    .filter(isObject);
}

/** Text the hotelier sees for a message; media is not stored, only announced. */
function bodyOf(message: WaMessage): string {
  switch (message.type) {
    case 'text':
      return message.text?.body?.trim() ?? '';
    case 'image':
      return message.image?.caption ? `[image] ${message.image.caption}` : '[image]';
    case 'document':
      return `[document] ${message.document?.filename ?? message.document?.caption ?? ''}`.trim();
    default:
      return `[${message.type}]`;
  }
}

/**
 * One webhook call can carry several messages, or none at all (delivery
 * statuses use the same endpoint): this returns every message it contains.
 */
export function fromWhatsApp(dto: WhatsAppWebhookDto): InboundMessage[] {
  const result: InboundMessage[] = [];
  for (const value of changeValues(dto.entry)) {
    for (const message of value.messages ?? []) {
      const phone = toE164(message.from);
      if (!phone || !message.id) {
        continue;
      }
      const name = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
      result.push({
        channel: Channel.WhatsApp,
        externalId: message.id,
        body: bodyOf(message),
        sentAt: new Date(Number(message.timestamp) * 1000),
        sender: { phone, name },
      });
    }
  }
  return result;
}
