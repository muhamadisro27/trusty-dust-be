import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSearchItemDto {
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

  @ApiPropertyOptional()
  jobType?: string | null;

  @ApiProperty({ description: 'Current trust score (0-1000)' })
  trustScore: number;

  @ApiProperty({ description: 'Whether the requester already follows this user' })
  isFollowing: boolean;
}

export class UserSearchResponseDto {
  @ApiProperty({ type: [UserSearchItemDto] })
  data: UserSearchItemDto[];

  @ApiPropertyOptional({ description: 'Cursor for the next page' })
  nextCursor?: string | null;
}

