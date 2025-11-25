import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class ApplyJobDto {
  @ApiPropertyOptional({ description: 'Proof ID satisfying job minTrustScore' })
  @IsOptional()
  @IsString()
  zkProofId?: string;

  @ApiPropertyOptional({
    description: 'URL to uploaded CV document',
    example: 'https://ipfs.io/ipfs/Qm...',
  })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional({
    description: 'Portfolio links entered by applicant',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolioLinks?: string[];

  @ApiPropertyOptional({
    description: 'Any extra metadata FE wants to attach',
    type: 'object',
    example: { cvIpfsCid: 'Qm...', coverLetter: '...' },
  })
  @IsOptional()
  @IsObject()
  extraMetadata?: Record<string, any>;
}
