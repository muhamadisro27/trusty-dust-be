import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserPublicProfileStatsDto {
  @ApiProperty()
  followers: number;

  @ApiProperty()
  following: number;

  @ApiProperty()
  posts: number;

  @ApiProperty()
  jobs: number;
}

export class UserPublicProfileDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;

  @ApiPropertyOptional()
  jobTitle?: string | null;

  @ApiPropertyOptional()
  jobType?: string | null;

  @ApiProperty()
  tier: string;

  @ApiProperty({ description: 'Current trust score (0-1000)' })
  trustScore: number;

  @ApiProperty({ description: 'Wallet address (lowercased)' })
  walletAddress: string;

  @ApiProperty({ description: 'Account creation timestamp ISO string' })
  createdAt: Date;

  @ApiProperty({ type: UserPublicProfileStatsDto })
  stats: UserPublicProfileStatsDto;

  @ApiProperty({ description: 'True when requester equals profile owner' })
  isMe: boolean;

  @ApiProperty({ description: 'True when requester already follows the user' })
  isFollowing: boolean;
}

