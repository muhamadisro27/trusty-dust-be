import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UsersModule (e2e)', () => {
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
      prisma.userTokenBalance.deleteMany(),
      prisma.token.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  const createUserAndToken = async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xuser000000000000000000000000000000000001',
        username: 'tester',
        tier: 'Dust',
        trustScore: 123,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });
    return { user, token };
  };

  it('GET /users/me returns profile', async () => {
    const { token, user } = await createUserAndToken();

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.id).toBe(user.id);
    expect(response.body.walletAddress).toBe(user.walletAddress);
  });

  it('PATCH /users/me updates username & avatar', async () => {
    const { token } = await createUserAndToken();

    const payload = { username: 'newname', avatar: 'https://avatar.example/test.png' };
    const response = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200);

    expect(response.body.username).toBe('newname');
    expect(response.body.avatar).toBe('https://avatar.example/test.png');
  });
});
