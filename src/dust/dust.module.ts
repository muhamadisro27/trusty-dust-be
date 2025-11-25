import { Module } from '@nestjs/common';
import { DustService } from './dust.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DustService],
  exports: [DustService],
})
export class DustModule {}
