import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingOutboundSender, OutboundSender } from '../outbound/outbound-sender';
import { Conversation } from './conversation.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Message } from './message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [ConversationsController],
  providers: [ConversationsService, { provide: OutboundSender, useClass: LoggingOutboundSender }],
})
export class ConversationsModule {}
