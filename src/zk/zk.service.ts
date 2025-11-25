import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZkProver } from './zk.prover';
import { Prisma } from '@prisma/client';
import {
  GenerateScoreProofPayload,
  VerifyProofPayload,
  ZkProofResult,
} from './zk.types';

@Injectable()
export class ZkService {
  private readonly logger = new Logger(ZkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly zkProver: ZkProver,
  ) {}

  async generateScoreProof(
    payload: GenerateScoreProofPayload,
  ): Promise<ZkProofResult & { proofId: string }> {
    this.logger.log(
      `Generating wallet score proof for user ${payload.userId ?? 'anonymous'} with score ${payload.score}`,
    );
    const witnessInput = {
      score: Math.round(payload.score).toString(),
      minScore: Math.round(payload.minScore).toString(),
    };
    const proofResult = await this.zkProver.generateProof(witnessInput);
    const data: Prisma.ZkProofUncheckedCreateInput = {
      userId: payload.userId ?? undefined,
      minScore: payload.minScore,
      proof: proofResult.proof,
      publicInputs: proofResult.publicInputs,
    };
    const record = await this.prisma.zkProof.create({ data });
    return { ...proofResult, proofId: record.id };
  }

  async verifyOnChain(dto: VerifyProofPayload) {
    this.logger.log('Verifying proof via blockchain');
    const valid = await this.blockchain.verifyTrustProof({
      proof: dto.proof,
      publicInputs: dto.publicInputs,
    });
    if (!valid) {
      throw new BadRequestException('Invalid ZK proof');
    }
    return { valid };
  }

  async assertProof(userId: string, minScore: number, proofId?: string) {
    const proof = proofId
      ? await this.prisma.zkProof.findUnique({ where: { id: proofId } })
      : await this.prisma.zkProof.findFirst({
          where: { userId, minScore: { gte: minScore } },
          orderBy: { createdAt: 'desc' },
        });
    if (proof?.userId !== userId || proof.minScore < minScore) {
      this.logger.warn(`Proof assertion failed for user ${userId}`);
      throw new BadRequestException('ZK proof missing or insufficient');
    }
    return proof;
  }

  queueProofRequest(userId: string, minScore: number) {
    this.logger.debug(`Queue proof request for user ${userId}`);
    return this.prisma.trustSnapshot.create({
      data: {
        userId,
        score: minScore,
        metadata: 'proof_requested',
      },
    });
  }
}
