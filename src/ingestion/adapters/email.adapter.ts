import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Channel } from '../../common/channel';
import { InboundMessage } from '../inbound-message';

/** Subset of Postmark's inbound webhook; other inbound-email providers map the same way. */
export class EmailWebhookDto {
  @ApiProperty({ example: '<CAF=abc@mail.gmail.com>' })
  @IsString()
  @IsNotEmpty()
  MessageID: string;

  @ApiProperty({ example: 'guest@example.com' })
  @IsEmail()
  From: string;

  @ApiPropertyOptional({ example: 'Marie Dupont' })
  @IsOptional()
  @IsString()
  FromName?: string;

  @ApiPropertyOptional({ example: 'Late check-in' })
  @IsOptional()
  @IsString()
  Subject?: string;

  @ApiProperty({ example: 'Hello, we will arrive around 11pm. Is that OK?' })
  @IsString()
  TextBody: string;

  @ApiPropertyOptional({ example: '2026-10-05T18:30:00Z' })
  @IsOptional()
  @IsISO8601()
  Date?: string;
}

export function fromEmail(dto: EmailWebhookDto, now: Date = new Date()): InboundMessage {
  return {
    channel: Channel.Email,
    externalId: dto.MessageID,
    body: dto.TextBody.trim(),
    sentAt: dto.Date ? new Date(dto.Date) : now,
    sender: { email: dto.From.toLowerCase(), name: dto.FromName?.trim() || undefined },
    subject: dto.Subject?.trim() || undefined,
  };
}
