import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailWebhookDto, fromEmail } from './adapters/email.adapter';
import { fromSms, SmsWebhookDto } from './adapters/sms.adapter';
import { fromWhatsApp, WhatsAppWebhookDto } from './adapters/whatsapp.adapter';
import { IngestionResult, IngestionService } from './ingestion.service';

/**
 * Entry points called by the providers. They answer 200 even for a retry
 * already stored: a non-2xx would only make the provider retry again.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound email (Postmark format)' })
  email(@Body() dto: EmailWebhookDto): Promise<IngestionResult> {
    return this.ingestion.ingest(fromEmail(dto));
  }

  @Post('sms')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound SMS (Twilio format, JSON or form-encoded)' })
  sms(@Body() dto: SmsWebhookDto): Promise<IngestionResult> {
    return this.ingestion.ingest(fromSms(dto));
  }

  @Post('whatsapp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound WhatsApp messages (Cloud API format)' })
  async whatsapp(@Body() dto: WhatsAppWebhookDto): Promise<{ results: IngestionResult[] }> {
    const results: IngestionResult[] = [];
    // Sequential on purpose: two messages from a new guest must not race to create them.
    for (const message of fromWhatsApp(dto)) {
      results.push(await this.ingestion.ingest(message));
    }
    return { results };
  }
}
