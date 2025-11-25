import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DustModule } from '../dust/dust.module';
import { TrustModule } from '../trust/trust.module';
import { NotificationModule } from '../notifications/notification.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, DustModule, TrustModule, NotificationModule, BlockchainModule],
  providers: [SocialService],
  controllers: [SocialController],
})
export class SocialModule {}
