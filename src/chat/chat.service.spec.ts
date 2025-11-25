import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatService', () => {
  const prisma = {
    user: { findMany: jest.fn() },
    chatConversation: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    chatParticipant: {
      findFirst: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(prisma, config);
  });

  it('throws when participant missing on createConversation', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-1' }]);
    await expect(
      service.createConversation('user-1', { participantIds: ['ghost'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates conversation with unique participants', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);
    (prisma.chatConversation.create as jest.Mock).mockResolvedValue({ id: 'conv' });

    await service.createConversation('user-1', { participantIds: ['user-2', 'user-2'] });

    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: {
        title: undefined,
        participants: {
          create: [{ userId: 'user-1' }, { userId: 'user-2' }],
        },
      },
      include: { participants: { select: { userId: true } } },
    });
  });

  it('prevents non members from reading messages', async () => {
    (prisma.chatParticipant.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.listMessages('user-1', 'conv-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates message for participant', async () => {
    (prisma.chatParticipant.findFirst as jest.Mock).mockResolvedValue({ id: 'member' });
    (prisma.chatMessage.create as jest.Mock).mockResolvedValue({ id: 'msg' });

    const result = await service.sendMessage('user-1', {
      conversationId: 'conv-1',
      content: 'gm',
    });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'gm',
        attachments: undefined,
        metadata: undefined,
      },
      include: { sender: { select: { id: true, username: true, avatar: true } } },
    });
    expect(result).toEqual({ id: 'msg' });
  });
});
