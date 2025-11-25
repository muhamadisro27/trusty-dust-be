import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly supabase?: SupabaseClient;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      });
      this.logger.log('Supabase realtime client initialised for chat broadcasting');
    } else {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing. Chat realtime disabled.');
    }
  }

  async listConversations(userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { select: { userId: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const participantIds = Array.from(new Set([userId, ...dto.participantIds]));
    const users = await this.prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true },
    });
    if (users.length !== participantIds.length) {
      throw new NotFoundException('One or more participant IDs are invalid');
    }

    const conversation = await this.prisma.chatConversation.create({
      data: {
        title: dto.title,
        participants: {
          create: participantIds.map((participantId) => ({ userId: participantId })),
        },
      },
      include: {
        participants: { select: { userId: true } },
      },
    });

    await this.broadcastEvent(conversation.id, 'conversation.created', {
      conversationId: conversation.id,
      title: conversation.title,
      participantIds,
    });

    return conversation;
  }

  async listMessages(userId: string, conversationId: string, limit?: number) {
    await this.ensureParticipant(conversationId, userId);
    const take = Math.min(Math.max(limit ?? DEFAULT_MESSAGE_LIMIT, 1), MAX_MESSAGE_LIMIT);

    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async sendMessage(userId: string, dto: SendMessageDto) {
    await this.ensureParticipant(dto.conversationId, userId);

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        content: dto.content,
        attachments: dto.attachments?.length ? (dto.attachments as Prisma.InputJsonValue) : undefined,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    await this.broadcastEvent(dto.conversationId, 'message.new', {
      conversationId: dto.conversationId,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
        attachments: message.attachments,
        metadata: message.metadata,
      },
    });

    return message;
  }

  private async ensureParticipant(conversationId: string, userId: string) {
    const membership = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }
  }

  private async broadcastEvent(conversationId: string, event: string, payload: Record<string, unknown>) {
    if (!this.supabase) {
      return;
    }

    try {
      const channel = this.supabase.channel(`chat:${conversationId}`, {
        config: { broadcast: { self: true } },
      });
      await channel.subscribe();
      const result = await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
      if (result !== 'ok') {
        this.logger.warn(`Supabase broadcast ${event} failed with status ${result}`, {
          conversationId,
        });
      }
      await channel.unsubscribe();
    } catch (error) {
      this.logger.error(
        `Failed to broadcast Supabase event ${event}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
