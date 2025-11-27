import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ConversationParticipantDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;

  @ApiProperty()
  joinedAt: Date;
}

class ConversationLastMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  createdAt: Date;
}

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ description: 'Optional title for group conversations' })
  title?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [ConversationParticipantDto] })
  participants: ConversationParticipantDto[];

  @ApiPropertyOptional({ type: ConversationLastMessageDto })
  lastMessage?: ConversationLastMessageDto | null;
}

