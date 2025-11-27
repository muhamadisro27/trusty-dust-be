import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional({ description: 'Optional metadata payload for future features' })
  metadata?: Record<string, any> | null;

  @ApiProperty()
  createdAt: Date;
}

