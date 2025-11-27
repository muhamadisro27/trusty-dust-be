import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ description: 'True if notification already read' })
  isRead: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when read' })
  readAt?: Date | null;

  @ApiProperty()
  createdAt: Date;
}

