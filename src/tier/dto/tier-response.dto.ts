import { ApiProperty } from '@nestjs/swagger';

class TierHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  tier: string;

  @ApiProperty({ description: 'Trust score recorded when tier changed' })
  score: number;

  @ApiProperty()
  createdAt: Date;
}

export class TierResponseDto {
  @ApiProperty({ description: 'Current tier (Dust/Spark/Flare/Nova)' })
  tier: string;

  @ApiProperty({ type: [TierHistoryEntryDto] })
  history: TierHistoryEntryDto[];
}

