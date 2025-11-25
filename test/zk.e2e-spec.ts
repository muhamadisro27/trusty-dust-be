import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ZkProver } from '../src/zk/zk.prover';
import { BlockchainService } from '../src/blockchain/blockchain.service';

describe('ZkModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const proverMock = {
    generateProof: jest.fn().mockResolvedValue({ proof: '0xproof', publicInputs: ['1'] }),
  } as Partial<ZkProver>;
  const blockchainMock = {
    verifyTrustProof: jest.fn().mockResolvedValue(true),
  } as Partial<BlockchainService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZkProver)
      .useValue(proverMock)
      .overrideProvider(BlockchainService)
      .useValue(blockchainMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.zkProof.deleteMany();
  });

  it('POST /zk/generate stores proof entry', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/zk/generate')
      .send({ score: 720, minScore: 600, userId: 'user-1' })
      .expect(201);

    expect(response.body.proof).toBe('0xproof');
    const proofs = await prisma.zkProof.findMany();
    expect(proofs).toHaveLength(1);
  });

  it('POST /zk/verify returns valid flag', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/zk/verify')
      .send({ proof: '0xproof', publicInputs: ['1'] })
      .expect(201);

    expect(response.body.valid).toBe(true);
  });
});
