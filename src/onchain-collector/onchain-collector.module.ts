import { Module } from '@nestjs/common';
import { OnchainCollectorService } from './onchain-collector.service';

@Module({
  providers: [OnchainCollectorService],
  exports: [OnchainCollectorService],
})
export class OnchainCollectorModule {}
