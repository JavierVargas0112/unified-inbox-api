import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel, ConversationStatus } from '../common/channel';
import { Customer } from '../customers/customer.entity';
import { Message } from './message.entity';

/** One thread with one customer on one channel, whatever the channel's native format. */
@Entity('conversations')
@Index('idx_conversations_customer_channel_status', ['customerId', 'channel', 'status'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id', foreignKeyConstraintName: 'conversations_customer_id_fkey' })
  customer: Customer;

  @Column({ type: 'enum', enum: Channel, enumName: 'channel' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    enumName: 'conversation_status',
    default: ConversationStatus.Open,
  })
  status: ConversationStatus;

  /** Email subject; null for chat-like channels. */
  @Column({ type: 'text', nullable: true })
  subject: string | null;

  @Index('idx_conversations_last_message_at')
  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
