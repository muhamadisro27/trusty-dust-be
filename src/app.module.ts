import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SocialModule } from './social/social.module';
import { TrustModule } from './trust/trust.module';
import { ZkModule } from './zk/zk.module';
import { DustModule } from './dust/dust.module';
import { TierModule } from './tier/tier.module';
import { SbtModule } from './sbt/sbt.module';
import { JobsModule } from './jobs/jobs.module';
import { EscrowModule } from './escrow/escrow.module';
import { NotificationModule } from './notifications/notification.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ChatModule } from './chat/chat.module';
import { OnchainCollectorModule } from './onchain-collector/onchain-collector.module';
import { AiScoringModule } from './ai-scoring/ai-scoring.module';
import { WalletReputationModule } from './wallet-reputation/wallet-reputation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BlockchainModule,
    AuthModule,
    UsersModule,
    DustModule,
    TrustModule,
    SocialModule,
    TierModule,
    SbtModule,
    ZkModule,
    OnchainCollectorModule,
    AiScoringModule,
    JobsModule,
    EscrowModule,
    ChatModule,
    WalletReputationModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
