import { Module } from '@nestjs/common';
import { SbtService } from './sbt.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, BlockchainModule],
  providers: [SbtService],
  exports: [SbtService],
})
export class SbtModule {}
