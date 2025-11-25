import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('backend-jwt')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations the user participates in' })
  @ApiOkResponse({ description: 'Array of conversations with last message snapshot' })
  listConversations(@CurrentUser() user: RequestUser) {
    return this.chatService.listConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation' })
  createConversation(@CurrentUser() user: RequestUser, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(user.id, dto);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Fetch paginated messages for a conversation' })
  listMessages(
    @CurrentUser() user: RequestUser,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.chatService.listMessages(
      user.id,
      conversationId,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a chat message and broadcast via Supabase realtime' })
  sendMessage(@CurrentUser() user: RequestUser, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user.id, dto);
  }
}
