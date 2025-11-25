import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiScoringService } from './ai-scoring.service';
import { GeminiClientService } from './gemini-client.service';

@Module({
  imports: [ConfigModule],
  providers: [AiScoringService, GeminiClientService],
  exports: [AiScoringService],
})
export class AiScoringModule {}
