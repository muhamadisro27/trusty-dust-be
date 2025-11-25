import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { WalletReputationController } from './wallet-reputation.controller';
import { WalletReputationService } from './wallet-reputation.service';
import { OnchainCollectorModule } from '../onchain-collector/onchain-collector.module';
import { AiScoringModule } from '../ai-scoring/ai-scoring.module';
import { ZkService } from '../zk/zk.service';
import { ZkModule } from '../zk/zk.module';

@Module({
  imports: [OnchainCollectorModule, AiScoringModule, ZkModule],
  controllers: [WalletReputationController],
  providers: [
    WalletReputationService,
    ThrottlerGuard,
    {
      provide: 'WalletScoreProofGateway',
      useExisting: ZkService,
    },
  ],
})
export class WalletReputationModule {}
