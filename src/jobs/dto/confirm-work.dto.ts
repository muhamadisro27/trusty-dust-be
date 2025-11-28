import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ConfirmWorkDto {
  @ApiPropertyOptional({ description: 'Optional on-chain transaction hash for escrow release' })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiPropertyOptional({
    description: 'Poster-provided rating forwarded to on-chain job approval (1-5)',
    minimum: 1,
    maximum: 5,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
