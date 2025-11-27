import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';
import { SocialMediaDto } from './social-media.dto';

class PostDetailAuthorDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;

  @ApiProperty()
  tier: string;

  @ApiPropertyOptional()
  jobTitle?: string | null;

  @ApiProperty({ description: 'True if viewer follows the author' })
  isFollowedByViewer: boolean;
}

class ReactionCountsDto {
  @ApiProperty({ default: 0 })
  like: number;

  @ApiProperty({ default: 0 })
  comment: number;

  @ApiProperty({ default: 0 })
  repost: number;
}

class PostCommentAuthorDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;

  @ApiProperty()
  tier: string;
}

class PostCommentDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  text?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: PostCommentAuthorDto })
  author: PostCommentAuthorDto;
}

export class PostDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional()
  ipfsCid?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [SocialMediaDto] })
  media: SocialMediaDto[];

  @ApiProperty({ type: PostDetailAuthorDto })
  author: PostDetailAuthorDto;

  @ApiProperty({ type: ReactionCountsDto })
  reactionCounts: ReactionCountsDto;

  @ApiProperty({ enum: ReactionType, nullable: true })
  viewerReaction: ReactionType | null;

  @ApiProperty({ type: [PostCommentDto] })
  comments: PostCommentDto[];
}

