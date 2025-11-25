import { Module } from '@nestjs/common';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DustModule } from '../dust/dust.module';
import { TierModule } from '../tier/tier.module';

@Module({
  imports: [PrismaModule, DustModule, TierModule],
  providers: [TrustService],
  controllers: [TrustController],
  exports: [TrustService],
})
export class TrustModule {}
