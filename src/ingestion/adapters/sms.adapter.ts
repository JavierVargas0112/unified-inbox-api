import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Channel } from '../../common/channel';
import { toE164 } from '../../common/phone';
import { InboundMessage } from '../inbound-message';

/** Fields of Twilio's incoming-message webhook that the inbox needs. */
export class SmsWebhookDto {
  @ApiProperty({ example: 'SM1234567890abcdef1234567890abcdef' })
  @IsString()
  @IsNotEmpty()
  MessageSid: string;

  @ApiProperty({ example: '+33612345678' })
  @IsString()
  @IsNotEmpty()
  From: string;

  @ApiProperty({ example: 'Can I get a late checkout tomorrow?' })
  @IsString()
  Body: string;
}

export function fromSms(dto: SmsWebhookDto, now: Date = new Date()): InboundMessage {
  const phone = toE164(dto.From);
  if (!phone) {
    throw new BadRequestException(`Invalid sender number: ${dto.From}`);
  }
  return {
    channel: Channel.Sms,
    externalId: dto.MessageSid,
    body: dto.Body.trim(),
    // Twilio does not send a timestamp on this webhook: reception time is the best we have.
    sentAt: now,
    sender: { phone },
  };
}
