import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZkProver } from './zk.prover';
import { ZkProofResult } from './zk.types';

@Injectable()
export class ZkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly zkProver: ZkProver,
  ) {}
  private readonly logger = new Logger(ZkService.name);

  async generateProof(userId: string, minScore: number): Promise<ZkProofResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`Generating proof for user ${userId} with minScore ${minScore}`);

    const witnessInput = {
      userScore: user.trustScore.toString(),
      minScore: minScore.toString(),
    };

    const proofResult = await this.zkProver.generateProof(witnessInput);

    await this.prisma.zkProof.create({
      data: {
        userId,
        minScore,
        proof: proofResult.proof,
        publicInputs: proofResult.publicInputs,
      },
    });

    this.logger.log(`Proof generated for user ${userId}`);
    return proofResult;
  }

  async verifyProof(proof: string, publicInputs: string[]) {
    this.logger.log('Verifying proof via blockchain');
    const valid = await this.blockchain.verifyTrustProof({ proof, publicInputs });
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
    if (!proof || proof.userId !== userId || proof.minScore < minScore) {
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

  async generateProofForWalletScore(args: { userId?: string; score: number; minScore: number }) {
    this.logger.log(
      `Wallet score proof trigger for user ${args.userId ?? 'anonymous'} with score ${args.score}`,
    );
    if (!args.userId) {
      // No linked user, skip actual proving. In the future we can support anon proofs.
      return { proofId: null };
    }

    // TODO: integrate Noir/NoirJS proof generation for wallet-based score thresholds.
    await this.queueProofRequest(args.userId, args.minScore);
    return { proofId: null };
  }
}
