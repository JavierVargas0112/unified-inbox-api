import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ConversationStatus, Direction } from '../common/channel';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';
import { Customer } from '../customers/customer.entity';
import { InboundMessage } from './inbound-message';

export interface IngestionResult {
  conversationId: string;
  messageId: string;
  /** True when the provider re-sent a message that was already stored. */
  duplicate: boolean;
}

@Injectable()
export class IngestionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Stores one inbound message: finds or creates the customer, attaches the
   * message to their open conversation on that channel (or opens one), and
   * ignores provider retries. Runs in a single transaction.
   */
  ingest(inbound: InboundMessage): Promise<IngestionResult> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(Message, {
        channel: inbound.channel,
        externalId: inbound.externalId,
      });
      if (existing) {
        return { conversationId: existing.conversationId, messageId: existing.id, duplicate: true };
      }

      const customer = await this.findOrCreateCustomer(manager, inbound.sender);
      const conversation = await this.findOrOpenConversation(manager, customer, inbound);

      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(Message)
        .values({
          conversationId: conversation.id,
          channel: inbound.channel,
          direction: Direction.Inbound,
          body: inbound.body,
          externalId: inbound.externalId,
          sentAt: inbound.sentAt,
        })
        // A concurrent retry may have inserted it since the check above.
        .orIgnore()
        .returning(['id'])
        .execute();

      const row = inserted.raw as { id: string }[];
      if (row.length === 0) {
        const winner = await manager.findOneByOrFail(Message, {
          channel: inbound.channel,
          externalId: inbound.externalId,
        });
        return { conversationId: winner.conversationId, messageId: winner.id, duplicate: true };
      }

      if (inbound.sentAt > conversation.lastMessageAt) {
        await manager.update(Conversation, conversation.id, { lastMessageAt: inbound.sentAt });
      }
      return { conversationId: conversation.id, messageId: row[0].id, duplicate: false };
    });
  }

  private async findOrCreateCustomer(
    manager: EntityManager,
    sender: InboundMessage['sender'],
  ): Promise<Customer> {
    const key = sender.email ? { email: sender.email } : { phone: sender.phone };
    const found = await manager.findOneBy(Customer, key);
    if (found) {
      if (!found.name && sender.name) {
        found.name = sender.name;
        await manager.save(found);
      }
      return found;
    }
    await manager
      .createQueryBuilder()
      .insert()
      .into(Customer)
      .values({ ...key, name: sender.name ?? null })
      .orIgnore()
      .execute();
    return manager.findOneByOrFail(Customer, key);
  }

  private async findOrOpenConversation(
    manager: EntityManager,
    customer: Customer,
    inbound: InboundMessage,
  ): Promise<Conversation> {
    const open = await manager.findOne(Conversation, {
      where: {
        customerId: customer.id,
        channel: inbound.channel,
        status: ConversationStatus.Open,
      },
      order: { lastMessageAt: 'DESC' },
    });
    if (open) {
      return open;
    }
    return manager.save(
      manager.create(Conversation, {
        customerId: customer.id,
        channel: inbound.channel,
        status: ConversationStatus.Open,
        subject: inbound.subject ?? null,
        lastMessageAt: inbound.sentAt,
      }),
    );
  }
}
