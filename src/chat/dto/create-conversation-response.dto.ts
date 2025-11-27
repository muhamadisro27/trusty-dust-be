import { ApiProperty } from '@nestjs/swagger';
import { ConversationResponseDto } from './conversation-response.dto';

export class CreateConversationResponseDto extends ConversationResponseDto {
  @ApiProperty({ description: 'Primary participant (creator) user id' })
  ownerId: string;
}

