import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ChatModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.chatMessage.deleteMany(),
      prisma.chatParticipant.deleteMany(),
      prisma.chatConversation.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  const createUserAndToken = async (walletAddress: string) => {
    const user = await prisma.user.create({
      data: {
        walletAddress,
        username: walletAddress.slice(-4),
        tier: 'Dust',
        trustScore: 100,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress });
    return { user, token };
  };

  it('creates conversation and broadcasts messages via REST', async () => {
    const { user, token } = await createUserAndToken('0xposter0000000000000000000000000000000001');
    const peer = await prisma.user.create({
      data: {
        walletAddress: '0xworker0000000000000000000000000000000002',
        username: 'worker',
        tier: 'Dust',
        trustScore: 120,
      },
    });

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Job Follow-up', participantIds: [peer.id] })
      .expect(201);

    expect(conversationResponse.body.participants).toHaveLength(2);

    await request(app.getHttpServer())
      .post('/api/v1/chat/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: conversationResponse.body.id,
        content: 'Thanks for the submission!',
      })
      .expect(201);

    const messages = await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${conversationResponse.body.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(messages.body).toHaveLength(1);
    expect(messages.body[0].content).toBe('Thanks for the submission!');
    expect(messages.body[0].conversationId).toBe(conversationResponse.body.id);
    expect(messages.body[0].senderId).toBe(user.id);
  });
});
