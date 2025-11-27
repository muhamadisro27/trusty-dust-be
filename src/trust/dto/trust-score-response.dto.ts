import { ApiProperty } from '@nestjs/swagger';

export class TrustScoreResponseDto {
  @ApiProperty({ description: 'Current trust score (0-1000)' })
  trustScore: number;
}

