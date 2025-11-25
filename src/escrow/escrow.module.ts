import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [BlockchainModule, PrismaModule],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
