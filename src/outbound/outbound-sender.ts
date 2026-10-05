import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Channel } from '../common/channel';

export interface OutboundMessage {
  channel: Channel;
  to: { email?: string | null; phone?: string | null };
  body: string;
  subject?: string;
}

/**
 * Sends a reply on its original channel and returns the provider's message id.
 * Real providers (SMTP, Twilio, WhatsApp Cloud API) implement this same contract.
 */
export abstract class OutboundSender {
  abstract send(message: OutboundMessage): Promise<{ externalId: string }>;
}

/** Default sender: logs instead of calling a provider, so the API runs without credentials. */
@Injectable()
export class LoggingOutboundSender extends OutboundSender {
  private readonly logger = new Logger('OutboundSender');

  send(message: OutboundMessage): Promise<{ externalId: string }> {
    const to = message.channel === Channel.Email ? message.to.email : message.to.phone;
    this.logger.log(`[${message.channel}] → ${to}: ${message.body.slice(0, 60)}`);
    return Promise.resolve({ externalId: `local-${randomUUID()}` });
  }
}
