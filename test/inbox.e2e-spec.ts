import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, RecordingSender, whatsappWebhook } from './helpers';

describe('Unified inbox (e2e)', () => {
  let app: INestApplication<App>;
  let sender: RecordingSender;
  let reset: () => Promise<unknown>;

  beforeAll(async () => {
    ({ app, sender, reset } = await createTestApp());
  });

  beforeEach(async () => {
    await reset();
    sender.sent.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  const postSms = (sid: string, from: string, body: string) =>
    http().post('/webhooks/sms').type('form').send({ MessageSid: sid, From: from, Body: body });

  const postEmail = (id: string, from: string, body: string, subject = 'Late check-in') =>
    http()
      .post('/webhooks/email')
      .send({ MessageID: id, From: from, FromName: 'Marie', Subject: subject, TextBody: body });

  it('GET /health', async () => {
    await http().get('/health').expect(200, { status: 'ok' });
  });

  describe('ingestion', () => {
    it('threads messages from the same guest on the same channel', async () => {
      const first = await postSms('SM1', '+33612345678', 'Hi').expect(200);
      const second = await postSms('SM2', '+33 6 12 34 56 78', 'Still there?').expect(200);

      expect(second.body.conversationId).toBe(first.body.conversationId);
      const thread = await http().get(`/conversations/${first.body.conversationId}`).expect(200);
      expect(thread.body.messages.map((m: { body: string }) => m.body)).toEqual([
        'Hi',
        'Still there?',
      ]);
    });

    it('ignores a webhook the provider sends twice', async () => {
      const first = await postSms('SM1', '+33612345678', 'Hi').expect(200);
      const retry = await postSms('SM1', '+33612345678', 'Hi').expect(200);

      expect(retry.body).toEqual({ ...first.body, duplicate: true });
      const thread = await http().get(`/conversations/${first.body.conversationId}`);
      expect(thread.body.messages).toHaveLength(1);
    });

    it('recognises the same guest across SMS and WhatsApp', async () => {
      const sms = await postSms('SM1', '+33612345678', 'Hi').expect(200);
      const wa = await http()
        .post('/webhooks/whatsapp')
        .send(whatsappWebhook('33612345678', 'wamid.1', 'Bonjour', 'Marie'))
        .expect(200);

      const smsThread = await http().get(`/conversations/${sms.body.conversationId}`);
      const waThread = await http().get(`/conversations/${wa.body.results[0].conversationId}`);
      expect(waThread.body.id).not.toBe(smsThread.body.id);
      expect(waThread.body.customer.id).toBe(smsThread.body.customer.id);
      // The WhatsApp profile fills in the name the SMS did not have.
      expect(waThread.body.customer.name).toBe('Marie');
    });

    it('acknowledges WhatsApp status-only webhooks without storing anything', async () => {
      const statusOnly = {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }],
      };
      await http().post('/webhooks/whatsapp').send(statusOnly).expect(200, { results: [] });
      const inbox = await http().get('/conversations');
      expect(inbox.body.total).toBe(0);
    });

    it.each([
      ['/webhooks/email', { MessageID: 'x', From: 'not-an-email', TextBody: 'x' }],
      ['/webhooks/sms', { MessageSid: 'SM1', From: 'HOTEL', Body: 'x' }],
      ['/webhooks/sms', { From: '+33612345678', Body: 'x' }],
      ['/webhooks/whatsapp', { object: 'page', entry: [] }],
    ])('rejects an invalid payload on %s', async (url, payload) => {
      await http().post(url).send(payload).expect(400);
    });
  });

  describe('inbox', () => {
    it('lists every channel together, most recent activity first, with filters', async () => {
      await postEmail('<1@mail>', 'a@example.com', 'First');
      await postSms('SM1', '+33612345678', 'Second');

      const all = await http().get('/conversations').expect(200);
      expect(all.body.total).toBe(2);
      expect(all.body.items.map((c: { channel: string }) => c.channel)).toEqual(['sms', 'email']);

      const emailOnly = await http().get('/conversations?channel=email&limit=10').expect(200);
      expect(emailOnly.body.items).toHaveLength(1);
      expect(emailOnly.body.items[0].customer.email).toBe('a@example.com');

      await http().get('/conversations?channel=fax').expect(400);
      await http().get('/conversations?limit=500').expect(400);
    });

    it('returns 404 for an unknown conversation and 400 for a malformed id', async () => {
      await http().get('/conversations/00000000-0000-4000-8000-000000000000').expect(404);
      await http().get('/conversations/not-a-uuid').expect(400);
    });
  });

  describe('replies', () => {
    it('replies to an email thread by email, with a Re: subject', async () => {
      const { body } = await postEmail('<1@mail>', 'a@example.com', 'Late?', 'Re: Late check-in');

      const reply = await http()
        .post(`/conversations/${body.conversationId}/replies`)
        .send({ body: 'No problem, see you tonight.' })
        .expect(201);

      expect(reply.body).toMatchObject({ direction: 'outbound', channel: 'email' });
      expect(sender.sent).toEqual([
        {
          channel: 'email',
          to: { email: 'a@example.com', phone: null },
          body: 'No problem, see you tonight.',
          subject: 'Re: Late check-in',
        },
      ]);
      const thread = await http().get(`/conversations/${body.conversationId}`);
      expect(thread.body.messages.map((m: { direction: string }) => m.direction)).toEqual([
        'inbound',
        'outbound',
      ]);
    });

    it('replies to an SMS by SMS and refuses one that is too long', async () => {
      const { body } = await postSms('SM1', '+33612345678', 'Hi');
      const url = `/conversations/${body.conversationId}/replies`;

      await http().post(url).send({ body: 'Hello!' }).expect(201);
      expect(sender.sent[0]).toMatchObject({ channel: 'sms', to: { phone: '+33612345678' } });

      const tooLong = await http()
        .post(url)
        .send({ body: 'a'.repeat(2000) })
        .expect(422);
      expect(tooLong.body.message).toMatch(/segments/);
      await http().post(url).send({ body: '' }).expect(400);
      expect(sender.sent).toHaveLength(1);
    });

    it('refuses to reply to a closed conversation until it is reopened', async () => {
      const { body } = await postSms('SM1', '+33612345678', 'Thanks, bye');
      const conversation = `/conversations/${body.conversationId}`;

      await http().patch(conversation).send({ status: 'closed' }).expect(200);
      await http().post(`${conversation}/replies`).send({ body: 'Bye' }).expect(409);

      // A new message from the guest opens a fresh conversation.
      const next = await postSms('SM2', '+33612345678', 'Forgot my charger');
      expect(next.body.conversationId).not.toBe(body.conversationId);

      await http().patch(conversation).send({ status: 'open' }).expect(200);
      await http().post(`${conversation}/replies`).send({ body: 'Bye' }).expect(201);
      await http().patch(conversation).send({ status: 'archived' }).expect(400);
      await http()
        .patch('/conversations/00000000-0000-4000-8000-000000000000')
        .send({ status: 'closed' })
        .expect(404);
    });
  });
});
