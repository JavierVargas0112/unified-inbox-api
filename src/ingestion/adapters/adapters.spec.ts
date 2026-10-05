import { BadRequestException } from '@nestjs/common';
import { Channel } from '../../common/channel';
import { fromEmail } from './email.adapter';
import { fromSms } from './sms.adapter';
import { fromWhatsApp } from './whatsapp.adapter';

const now = new Date('2026-10-05T12:00:00Z');

describe('fromEmail', () => {
  it('maps a Postmark payload to an inbound message', () => {
    const message = fromEmail({
      MessageID: '<abc@mail>',
      From: 'Guest@Example.com',
      FromName: ' Marie Dupont ',
      Subject: ' Late check-in ',
      TextBody: '  Arriving at 11pm.\n',
      Date: '2026-10-05T18:30:00Z',
    });
    expect(message).toEqual({
      channel: Channel.Email,
      externalId: '<abc@mail>',
      body: 'Arriving at 11pm.',
      sentAt: new Date('2026-10-05T18:30:00Z'),
      sender: { email: 'guest@example.com', name: 'Marie Dupont' },
      subject: 'Late check-in',
    });
  });

  it('falls back to reception time and drops empty optional fields', () => {
    const message = fromEmail(
      { MessageID: 'id', From: 'a@b.co', FromName: ' ', Subject: '', TextBody: 'hi' },
      now,
    );
    expect(message.sentAt).toEqual(now);
    expect(message.sender.name).toBeUndefined();
    expect(message.subject).toBeUndefined();
  });
});

describe('fromSms', () => {
  it('maps a Twilio payload and normalises the number', () => {
    expect(fromSms({ MessageSid: 'SM1', From: '+33 6 12 34 56 78', Body: ' Hi ' }, now)).toEqual({
      channel: Channel.Sms,
      externalId: 'SM1',
      body: 'Hi',
      sentAt: now,
      sender: { phone: '+33612345678' },
    });
  });

  it('rejects a sender that is not a phone number', () => {
    expect(() => fromSms({ MessageSid: 'SM1', From: 'HOTEL', Body: 'x' })).toThrow(
      BadRequestException,
    );
  });
});

describe('fromWhatsApp', () => {
  const webhook = (value: object) => ({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value }] }],
  });

  it('extracts every message with the contact name', () => {
    const messages = fromWhatsApp(
      webhook({
        contacts: [{ wa_id: '33612345678', profile: { name: 'Marie' } }],
        messages: [
          {
            id: 'wamid.1',
            from: '33612345678',
            timestamp: '1759665600',
            type: 'text',
            text: { body: ' Bonjour ' },
          },
          {
            id: 'wamid.2',
            from: '33612345678',
            timestamp: '1759665660',
            type: 'image',
            image: { caption: 'the stain' },
          },
        ],
      }),
    );
    expect(messages).toEqual([
      {
        channel: Channel.WhatsApp,
        externalId: 'wamid.1',
        body: 'Bonjour',
        sentAt: new Date(1759665600 * 1000),
        sender: { phone: '+33612345678', name: 'Marie' },
      },
      expect.objectContaining({ externalId: 'wamid.2', body: '[image] the stain' }),
    ]);
  });

  it.each([
    [{ type: 'image', image: {} }, '[image]'],
    [{ type: 'document', document: { filename: 'invoice.pdf' } }, '[document] invoice.pdf'],
    [{ type: 'document', document: {} }, '[document]'],
    [{ type: 'location' }, '[location]'],
    [{ type: 'text' }, ''],
  ])('describes %p as %p', (content, body) => {
    const [message] = fromWhatsApp(
      webhook({ messages: [{ id: 'w', from: '33612345678', timestamp: '1', ...content }] }),
    );
    expect(message.body).toBe(body);
    expect(message.sender.name).toBeUndefined();
  });

  it('returns nothing for status updates and malformed entries', () => {
    expect(fromWhatsApp(webhook({ statuses: [{ id: 'wamid.1', status: 'read' }] }))).toEqual([]);
    expect(
      fromWhatsApp({ object: 'whatsapp_business_account', entry: [null, { changes: 'x' }] }),
    ).toEqual([]);
  });

  it('skips messages without a valid sender or id', () => {
    expect(
      fromWhatsApp(
        webhook({
          messages: [
            { id: 'w1', from: 'abc', timestamp: '1', type: 'text' },
            { from: '33612345678', timestamp: '1', type: 'text' },
          ],
        }),
      ),
    ).toEqual([]);
  });
});
