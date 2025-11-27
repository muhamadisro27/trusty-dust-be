import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';
import { SocialMediaDto } from './social-media.dto';

class SocialAuthorPreviewDto {
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

  @ApiProperty({ description: 'True if viewer already follows this author' })
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

class CommentPreviewAuthorDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;

  @ApiProperty()
  tier: string;
}

class CommentPreviewDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  text?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: CommentPreviewAuthorDto })
  author: CommentPreviewAuthorDto;
}

export class FeedPostDto {
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

  @ApiProperty({ type: SocialAuthorPreviewDto })
  author: SocialAuthorPreviewDto;

  @ApiProperty({ type: ReactionCountsDto })
  reactionCounts: ReactionCountsDto;

  @ApiProperty({ enum: ReactionType, nullable: true })
  viewerReaction: ReactionType | null;

  @ApiProperty({ type: [CommentPreviewDto] })
  commentPreview: CommentPreviewDto[];
}

export class SocialFeedResponseDto {
  @ApiProperty({ type: [FeedPostDto] })
  data: FeedPostDto[];

  @ApiPropertyOptional({ description: 'Cursor for the next page of posts' })
  nextCursor?: string | null;
}

