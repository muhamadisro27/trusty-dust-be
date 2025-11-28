import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DustModule } from '../dust/dust.module';
import { TrustModule } from '../trust/trust.module';
import { NotificationModule } from '../notifications/notification.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PinataService } from '../ipfs/pinata.service';

@Module({
  imports: [PrismaModule, DustModule, TrustModule, NotificationModule, BlockchainModule],
  providers: [SocialService, ThrottlerGuard, PinataService],
  controllers: [SocialController],
})
export class SocialModule {}
