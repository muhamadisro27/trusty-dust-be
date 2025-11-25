import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DustModule } from '../dust/dust.module';
import { TrustModule } from '../trust/trust.module';
import { EscrowModule } from '../escrow/escrow.module';
import { ZkModule } from '../zk/zk.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, DustModule, TrustModule, EscrowModule, ZkModule, NotificationModule],
  providers: [JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
