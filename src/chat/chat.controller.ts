import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { CreateConversationResponseDto } from './dto/create-conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('Chat')
@ApiBearerAuth('backend-jwt')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @Throttle({ chatList: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List conversations the user participates in' })
  @ApiOkResponse({
    description: 'Array of conversations with last message snapshot',
    type: [ConversationResponseDto],
  })
  listConversations(@CurrentUser() user: RequestUser) {
    return this.chatService.listConversations(user.userId);
  }

  @Post('conversations')
  @Throttle({ chatCreate: { limit: 20, ttl: 60 } })
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ type: CreateConversationDto })
  @ApiCreatedResponse({ description: 'New conversation object', type: CreateConversationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid participant list or duplicate chat' })
  createConversation(@CurrentUser() user: RequestUser, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(user.userId, dto);
  }

  @Get('conversations/:conversationId/messages')
  @Throttle({ chatMessages: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Fetch paginated messages for a conversation' })
  @ApiOkResponse({ description: 'Array of chat messages', type: [MessageResponseDto] })
  @ApiNotFoundResponse({ description: 'Conversation not found or user not participant' })
  listMessages(
    @CurrentUser() user: RequestUser,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.chatService.listMessages(
      user.userId,
      conversationId,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @Post('messages')
  @Throttle({ chatSend: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'Send a chat message and broadcast via Supabase realtime' })
  @ApiBody({ type: SendMessageDto })
  @ApiCreatedResponse({ description: 'Message persisted and broadcast', type: MessageResponseDto })
  @ApiBadRequestResponse({ description: 'Sender not part of conversation or invalid payload' })
  sendMessage(@CurrentUser() user: RequestUser, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user.userId, dto);
  }
}
