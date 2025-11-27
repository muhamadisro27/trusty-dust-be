import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';

export class PostReactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ReactionType })
  type: ReactionType;

  @ApiPropertyOptional({ description: 'Comment body when type = COMMENT' })
  commentText?: string | null;

  @ApiProperty()
  createdAt: Date;
}

