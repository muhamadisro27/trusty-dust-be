import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { DustService } from '../src/dust/dust.service';
import { TrustService } from '../src/trust/trust.service';
import { NotificationService } from '../src/notifications/notification.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';

describe('SocialModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const dustMock = {
    rewardUser: jest.fn(),
    spendDust: jest.fn(),
  } as Partial<DustService>;
  const trustMock = {
    recordEvent: jest.fn(),
  } as Partial<TrustService>;
  const notificationMock = {
    notify: jest.fn(),
  } as Partial<NotificationService>;
  const blockchainMock = {
    burnDustBoost: jest.fn(),
  } as Partial<BlockchainService>;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DustService)
      .useValue(dustMock)
      .overrideProvider(TrustService)
      .useValue(trustMock)
      .overrideProvider(NotificationService)
      .useValue(notificationMock)
      .overrideProvider(BlockchainService)
      .useValue(blockchainMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.$transaction([
      prisma.postBoost.deleteMany(),
      prisma.postReaction.deleteMany(),
      prisma.post.deleteMany(),
      prisma.userTokenBalance.deleteMany(),
      prisma.token.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  const createUserAndToken = async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xposter0000000000000000000000000000000001',
        username: 'poster',
        tier: 'Dust',
        trustScore: 200,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });
    return { user, token };
  };

  it('POST /social/posts creates a post and triggers reward flow', async () => {
    const { token } = await createUserAndToken();

    const response = await request(app.getHttpServer())
      .post('/api/v1/social/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'gm zk', mediaUrls: ['https://img'] })
      .expect(201);

    expect(response.body.text).toBe('gm zk');
    expect(response.body.PostMedia).toHaveLength(1);
    expect(dustMock.rewardUser).toHaveBeenCalled();
    expect(trustMock.recordEvent).toHaveBeenCalled();
    expect(notificationMock.notify).toHaveBeenCalled();
  });

  it('POST /social/posts/:id/react stores reaction', async () => {
    const { token, user } = await createUserAndToken();
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        text: 'hello',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/social/posts/${post.id}/react`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'LIKE' })
      .expect(201);

    const reactions = await prisma.postReaction.findMany();
    expect(reactions).toHaveLength(1);
    expect(dustMock.rewardUser).toHaveBeenCalled();
  });

  it('POST /social/posts/:id/boost burns dust & notifies author', async () => {
    const { token, user } = await createUserAndToken();
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        text: 'boost me',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/social/posts/${post.id}/boost`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5 })
      .expect(201);

    expect(dustMock.spendDust).toHaveBeenCalledWith(user.id, 5, 'post_boost');
    expect(blockchainMock.burnDustBoost).toHaveBeenCalled();
    expect(notificationMock.notify).toHaveBeenCalledWith(user.id, 'Your post received a boost');
  });
});
