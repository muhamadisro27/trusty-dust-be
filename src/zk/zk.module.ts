import { Module } from '@nestjs/common';
import { ZkService } from './zk.service';
import { ZkController } from './zk.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ZkProver } from './zk.prover';
import { ZkCompiler } from './zk.compiler';

@Module({
  imports: [PrismaModule, BlockchainModule],
  providers: [ZkService, ZkProver, ZkCompiler],
  controllers: [ZkController],
  exports: [ZkService],
})
export class ZkModule {}
