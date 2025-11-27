import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';

class PostMediaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  url: string;
}

class ReactionCountsDto {
  @ApiProperty({ default: 0 })
  like: number;

  @ApiProperty({ default: 0 })
  comment: number;

  @ApiProperty({ default: 0 })
  repost: number;
}

export class UserProfilePostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional()
  ipfsCid?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [PostMediaDto] })
  media: PostMediaDto[];

  @ApiProperty({ type: ReactionCountsDto })
  reactionCounts: ReactionCountsDto;

  @ApiProperty({ enum: ReactionType, nullable: true })
  viewerReaction: ReactionType | null;
}

export class UserProfilePostsResponseDto {
  @ApiProperty({ type: [UserProfilePostDto] })
  data: UserProfilePostDto[];

  @ApiPropertyOptional({ description: 'Cursor for the next page of posts' })
  nextCursor?: string | null;
}

