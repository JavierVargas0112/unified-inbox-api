import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel, ConversationStatus, Direction } from '../common/channel';
import { replyViolation } from '../outbound/channel-rules';
import { OutboundSender } from '../outbound/outbound-sender';
import { Conversation } from './conversation.entity';
import { ListConversationsQuery } from './dto/conversation.dto';
import { Message } from './message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly sender: OutboundSender,
  ) {}

  /** The unified inbox: every channel together, most recent activity first. */
  async list(query: ListConversationsQuery) {
    const [items, total] = await this.conversations.findAndCount({
      where: { status: query.status, channel: query.channel },
      relations: { customer: true },
      order: { lastMessageAt: 'DESC' },
      take: query.limit,
      skip: query.offset,
    });
    return { items, total };
  }

  async get(id: string) {
    const conversation = await this.conversations.findOne({
      where: { id },
      relations: { customer: true },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    const messages = await this.messages.find({
      where: { conversationId: id },
      order: { sentAt: 'ASC' },
    });
    return { ...conversation, messages };
  }

  /** Sends the reply on the channel the guest used, then stores it in the thread. */
  async reply(id: string, body: string): Promise<Message> {
    const conversation = await this.get(id);
    if (conversation.status === ConversationStatus.Closed) {
      throw new ConflictException('Conversation is closed; reopen it before replying');
    }
    const violation = replyViolation(conversation.channel, body);
    if (violation) {
      throw new UnprocessableEntityException(violation);
    }

    const subject =
      conversation.channel === Channel.Email && conversation.subject
        ? `Re: ${conversation.subject.replace(/^re:\s*/i, '')}`
        : undefined;
    const { externalId } = await this.sender.send({
      channel: conversation.channel,
      to: { email: conversation.customer.email, phone: conversation.customer.phone },
      body,
      subject,
    });

    const sentAt = new Date();
    const message = await this.messages.save(
      this.messages.create({
        conversationId: id,
        channel: conversation.channel,
        direction: Direction.Outbound,
        body,
        externalId,
        sentAt,
      }),
    );
    await this.conversations.update(id, { lastMessageAt: sentAt });
    return message;
  }

  async setStatus(id: string, status: ConversationStatus): Promise<Conversation> {
    const conversation = await this.conversations.findOneBy({ id });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    conversation.status = status;
    return this.conversations.save(conversation);
  }
}
