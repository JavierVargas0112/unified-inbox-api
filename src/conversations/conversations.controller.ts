import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { ListConversationsQuery, ReplyDto, UpdateConversationDto } from './dto/conversation.dto';

@ApiTags('inbox')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Unified inbox, most recent activity first' })
  list(@Query() query: ListConversationsQuery) {
    return this.conversations.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One conversation with its messages, oldest first' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.get(id);
  }

  @Post(':id/replies')
  @ApiOperation({ summary: 'Reply on the channel the guest used' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.conversations.reply(id, dto.body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Close or reopen a conversation' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
    return this.conversations.setStatus(id, dto.status);
  }
}
