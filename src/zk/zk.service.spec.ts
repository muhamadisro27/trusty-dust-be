import { BadRequestException } from '@nestjs/common';
import { ZkService } from './zk.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZkProver } from './zk.prover';

describe('ZkService', () => {
  const prisma = {
    zkProof: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    trustSnapshot: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;
  const blockchain = { verifyTrustProof: jest.fn() } as unknown as BlockchainService;
  const prover = { generateProof: jest.fn() } as unknown as ZkProver;

  let service: ZkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ZkService(prisma, blockchain, prover);
  });

  describe('generateScoreProof', () => {
    it('stores proof record and returns proofId', async () => {
      (prover.generateProof as jest.Mock).mockResolvedValue({
        proof: '0xproof',
        publicInputs: ['1'],
      });
      (prisma.zkProof.create as jest.Mock).mockResolvedValue({ id: 'proof-id' });

      const result = await service.generateScoreProof({ score: 720, minScore: 600, userId: 'user' });

      expect(prover.generateProof).toHaveBeenCalledWith({ score: '720', minScore: '600' });
      expect(prisma.zkProof.create).toHaveBeenCalledWith({
        data: { userId: 'user', minScore: 600, proof: '0xproof', publicInputs: ['1'] },
      });
      expect(result).toEqual({ proof: '0xproof', publicInputs: ['1'], proofId: 'proof-id' });
    });
  });

  describe('verifyOnChain', () => {
    it('throws when blockchain rejects proof', async () => {
      (blockchain.verifyTrustProof as jest.Mock).mockResolvedValue(false);
      await expect(service.verifyOnChain({ proof: '0x', publicInputs: [] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns valid flag when verification succeeds', async () => {
      (blockchain.verifyTrustProof as jest.Mock).mockResolvedValue(true);
      const result = await service.verifyOnChain({ proof: '0x', publicInputs: ['1'] });
      expect(result).toEqual({ valid: true });
    });
  });

  describe('assertProof', () => {
    it('prefers explicit proofId lookup', async () => {
      (prisma.zkProof.findUnique as jest.Mock).mockResolvedValue({
        id: 'proof',
        userId: 'user',
        minScore: 700,
      });
      const proof = await service.assertProof('user', 500, 'proof');
      expect(prisma.zkProof.findUnique).toHaveBeenCalledWith({ where: { id: 'proof' } });
      expect(proof).toEqual({ id: 'proof', userId: 'user', minScore: 700 });
    });

    it('falls back to recent proof search', async () => {
      (prisma.zkProof.findFirst as jest.Mock).mockResolvedValue({
        userId: 'user',
        minScore: 650,
      });
      await service.assertProof('user', 600);
      expect(prisma.zkProof.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user', minScore: { gte: 600 } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws when proof insufficient', async () => {
      (prisma.zkProof.findUnique as jest.Mock).mockResolvedValue({
        id: 'proof',
        userId: 'other',
        minScore: 200,
      });
      await expect(service.assertProof('user', 500, 'proof')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  it('queueProofRequest stores snapshot marker', async () => {
    (prisma.trustSnapshot.create as jest.Mock).mockResolvedValue({ id: 'snap' });
    const result = await service.queueProofRequest('user', 400);
    expect(result).toEqual({ id: 'snap' });
  });
});
