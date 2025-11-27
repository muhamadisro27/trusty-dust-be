import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, ApplicationStatus } from '@prisma/client';

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Auto-increment onchain reference' })
  chainRef: number;

  @ApiProperty({ description: 'Creator user id' })
  creatorId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  companyName: string;

  @ApiPropertyOptional()
  companyLogo?: string | null;

  @ApiProperty()
  location: string;

  @ApiProperty()
  jobType: string;

  @ApiProperty({ type: [String], description: 'Normalized requirement list' })
  requirements: string[];

  @ApiPropertyOptional()
  salaryMin?: number | null;

  @ApiPropertyOptional()
  salaryMax?: number | null;

  @ApiPropertyOptional({ description: 'ISO close date when provided' })
  closeAt?: Date | null;

  @ApiProperty({ description: 'Minimum trust score required to post/apply' })
  minTrustScore: number;

  @ApiProperty({ description: 'Reward held in escrow (USDC)' })
  reward: number;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class JobEscrowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ description: 'Reward amount locked onchain' })
  amount: number;

  @ApiProperty({ description: 'Tx hash used to lock escrow' })
  lockTxHash: string;

  @ApiPropertyOptional({ description: 'Tx hash when escrow released' })
  releaseTxHash?: string | null;

  @ApiPropertyOptional({ description: 'Tx hash when escrow refunded' })
  refundTxHash?: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class JobApplicationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty()
  workerId: string;
}

export class JobWithMetaDto extends JobResponseDto {
  @ApiProperty({ type: [JobApplicationSummaryDto] })
  applications: JobApplicationSummaryDto[];

  @ApiPropertyOptional({ type: JobEscrowDto })
  escrow?: JobEscrowDto | null;
}

export class JobCreatorPreviewDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;
}

export class JobSearchItemDto extends JobResponseDto {
  @ApiProperty({ type: JobCreatorPreviewDto })
  creator: JobCreatorPreviewDto;

  @ApiProperty({ description: 'Number of applications recorded for the job' })
  applications: number;
}

export class JobSearchResponseDto {
  @ApiProperty({ type: [JobSearchItemDto] })
  data: JobSearchItemDto[];

  @ApiPropertyOptional({ description: 'Cursor for the next page (job id)' })
  nextCursor?: string | null;
}

