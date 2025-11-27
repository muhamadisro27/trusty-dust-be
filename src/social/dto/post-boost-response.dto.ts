import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostBoostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Auto-increment sequence for boost ordering' })
  sequence: number;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'Amount of DUST spent' })
  dustSpent: number;

  @ApiPropertyOptional({ description: 'Optional booster note' })
  note?: string | null;

  @ApiProperty()
  createdAt: Date;
}

