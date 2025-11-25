import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { DustService } from '../src/dust/dust.service';
import { ZkService } from '../src/zk/zk.service';
import { NotificationService } from '../src/notifications/notification.service';
import { EscrowService } from '../src/escrow/escrow.service';

describe('JobsModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const dustMock = {
    spendDust: jest.fn(),
  } as Partial<DustService>;
  const zkMock = {
    assertProof: jest.fn().mockResolvedValue({ id: 'proof' }),
  } as Partial<ZkService>;
  const escrowMock = {
    lock: jest.fn(),
    release: jest.fn(),
  } as Partial<EscrowService>;
  const notificationMock = {
    notify: jest.fn(),
  } as Partial<NotificationService>;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DustService)
      .useValue(dustMock)
      .overrideProvider(ZkService)
      .useValue({
        ...zkMock,
        generateScoreProof: jest.fn(),
        verifyOnChain: jest.fn(),
      })
      .overrideProvider(NotificationService)
      .useValue(notificationMock)
      .overrideProvider(EscrowService)
      .useValue(escrowMock)
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
      prisma.jobApplication.deleteMany(),
      prisma.job.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('POST /jobs/create creates a job entry', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xposter00002',
        username: 'poster',
        tier: 'Dust',
        trustScore: 500,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });

    const payload = {
      title: 'Design badge',
      description: 'Need tiers icon',
      companyName: 'TrustyDust Studio',
      companyLogo: 'https://cdn.trustydust/logo.png',
      location: 'Remote',
      jobType: 'Contract',
      requirements: ['3+ years UI', 'Can start ASAP'],
      minTrustScore: 200,
      reward: 100,
      salaryMin: 120,
      salaryMax: 240,
      closeAt: '2030-01-01T00:00:00.000Z',
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/jobs/create')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(response.body.title).toBe('Design badge');
    expect(zkMock.assertProof).toHaveBeenCalled();
    expect(dustMock.spendDust).toHaveBeenCalledWith(user.id, 50, 'job_create');
    expect(escrowMock.lock).toHaveBeenCalled();
    expect(notificationMock.notify).toHaveBeenCalled();
  });

  it('POST /jobs/:id/apply creates application', async () => {
    const poster = await prisma.user.create({
      data: {
        walletAddress: '0xposterapp',
        username: 'poster',
        tier: 'Dust',
        trustScore: 600,
      },
    });
    const worker = await prisma.user.create({
      data: {
        walletAddress: '0xworker',
        username: 'worker',
        tier: 'Dust',
        trustScore: 500,
      },
    });
    const job = await prisma.job.create({
      data: {
        creatorId: poster.id,
        title: 'Test',
        description: 'desc',
        companyName: 'Studio',
        companyLogo: 'https://logo',
        location: 'Remote',
        jobType: 'Contract',
        requirements: ['Req'],
        minTrustScore: 200,
        reward: 100,
        status: 'OPEN',
      },
    });
    const token = await jwtService.signAsync({ userId: worker.id, walletAddress: worker.walletAddress });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${job.id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(response.body.status).toBe('APPLIED');
    expect(prisma.jobApplication.count()).resolves.toBe(1);
  });

  it('POST /jobs/application/:id/submit updates status', async () => {
    const worker = await prisma.user.create({
      data: {
        walletAddress: '0xworker2',
        username: 'worker2',
        tier: 'Dust',
        trustScore: 400,
      },
    });
    const job = await prisma.job.create({
      data: {
        creatorId: worker.id,
        title: 'Test2',
        description: 'desc',
        companyName: 'Studio',
        location: 'Remote',
        jobType: 'Gig',
        requirements: [],
        minTrustScore: 100,
        reward: 50,
        status: 'OPEN',
      },
    });
    const application = await prisma.jobApplication.create({
      data: {
        jobId: job.id,
        workerId: worker.id,
        status: 'APPLIED',
      },
    });
    const token = await jwtService.signAsync({ userId: worker.id, walletAddress: worker.walletAddress });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/jobs/application/${application.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ workSubmissionText: 'done' })
      .expect(201);

    expect(response.body.status).toBe('SUBMITTED');
  });

  it('POST /jobs/application/:id/confirm releases escrow', async () => {
    const poster = await prisma.user.create({
      data: {
        walletAddress: '0xposter3',
        username: 'poster3',
        tier: 'Dust',
        trustScore: 600,
      },
    });
    const worker = await prisma.user.create({
      data: {
        walletAddress: '0xworker3',
        username: 'worker3',
        tier: 'Dust',
        trustScore: 600,
      },
    });
    const job = await prisma.job.create({
      data: {
        creatorId: poster.id,
        title: 'Job 3',
        description: 'desc',
        companyName: 'Studio 3',
        location: 'Remote',
        jobType: 'Contract',
        requirements: [],
        minTrustScore: 100,
        reward: 75,
        status: 'OPEN',
        chainRef: 99,
      },
    });
    const application = await prisma.jobApplication.create({
      data: {
        jobId: job.id,
        workerId: worker.id,
        status: 'SUBMITTED',
      },
    });
    const token = await jwtService.signAsync({ userId: poster.id, walletAddress: poster.walletAddress });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/jobs/application/${application.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txHash: '0xtx' })
      .expect(201);

    expect(response.body.status).toBe('CONFIRMED');
    expect(escrowMock.release).toHaveBeenCalledWith(job.id, job.chainRef);
  });
});
