import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ThrottlerGuard],
  exports: [ChatService],
})
export class ChatModule {}
