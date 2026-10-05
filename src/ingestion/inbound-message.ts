import { Channel } from '../common/channel';

/**
 * What every channel adapter produces: the one shape the rest of the app knows about.
 * Adding a channel means writing an adapter to this interface, nothing else.
 */
export interface InboundMessage {
  channel: Channel;
  /** Provider's id for the message, used to drop webhook retries. */
  externalId: string;
  body: string;
  sentAt: Date;
  sender: {
    name?: string;
    email?: string;
    /** E.164, e.g. +33612345678. */
    phone?: string;
  };
  subject?: string;
}
