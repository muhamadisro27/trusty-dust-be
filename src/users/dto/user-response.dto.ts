import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'Internal user id (cuid)' })
  id: string;

  @ApiProperty({ description: 'Primary wallet address (lowercased)' })
  walletAddress: string;

  @ApiPropertyOptional({ description: 'Public username' })
  username?: string | null;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  avatar?: string | null;

  @ApiPropertyOptional({ description: 'Job title metadata' })
  jobTitle?: string | null;

  @ApiPropertyOptional({ description: 'Job type metadata' })
  jobType?: string | null;

  @ApiProperty({ description: 'Current tier label (Dust/Spark/Flare/Nova)' })
  tier: string;

  @ApiProperty({ description: 'Current trust score (0-1000)' })
  trustScore: number;

  @ApiProperty({ description: 'Creation timestamp ISO string' })
  createdAt: Date;

  @ApiProperty({ description: 'Update timestamp ISO string' })
  updatedAt: Date;
}

