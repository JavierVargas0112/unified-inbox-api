import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboundSender, OutboundMessage } from '../src/outbound/outbound-sender';

/** Records what would have been sent, instead of calling a provider. */
export class RecordingSender extends OutboundSender {
  readonly sent: OutboundMessage[] = [];

  send(message: OutboundMessage) {
    this.sent.push(message);
    return Promise.resolve({ externalId: `test-${this.sent.length}` });
  }
}

export async function createTestApp() {
  const sender = new RecordingSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OutboundSender)
    .useValue(sender)
    .compile();

  const app: INestApplication = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const reset = () =>
    dataSource.query('TRUNCATE "messages", "conversations", "customers" RESTART IDENTITY CASCADE');

  return { app, sender, dataSource, reset };
}

export const whatsappWebhook = (from: string, id: string, body: string, name?: string) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA',
      changes: [
        {
          field: 'messages',
          value: {
            contacts: name ? [{ wa_id: from, profile: { name } }] : [],
            messages: [{ id, from, timestamp: '1759665600', type: 'text', text: { body } }],
          },
        },
      ],
    },
  ],
});
