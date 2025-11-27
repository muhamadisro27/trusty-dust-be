import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSuggestionDto {
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
}

