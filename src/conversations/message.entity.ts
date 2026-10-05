import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel, Direction } from '../common/channel';
import { Conversation } from './conversation.entity';

@Entity('messages')
// Providers retry webhooks: the provider's own id makes ingestion idempotent.
@Index('uq_messages_channel_external_id', ['channel', 'externalId'], { unique: true })
@Index('idx_messages_conversation_sent_at', ['conversationId', 'sentAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'conversation_id',
    foreignKeyConstraintName: 'messages_conversation_id_fkey',
  })
  conversation: Conversation;

  @Column({ type: 'enum', enum: Channel, enumName: 'channel' })
  channel: Channel;

  @Column({ type: 'enum', enum: Direction, enumName: 'direction' })
  direction: Direction;

  @Column({ type: 'text' })
  body: string;

  /** Message id given by the provider (Message-ID, Twilio SID, WhatsApp wamid). */
  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
