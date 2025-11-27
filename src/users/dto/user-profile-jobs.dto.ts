import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';

export class UserProfileJobDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  companyName?: string | null;

  @ApiPropertyOptional()
  companyLogo?: string | null;

  @ApiPropertyOptional()
  location?: string | null;

  @ApiPropertyOptional()
  jobType?: string | null;

  @ApiProperty()
  reward: number;

  @ApiProperty({ description: 'Minimum trust score required to apply' })
  minTrustScore: number;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Total applicants for the job' })
  applications: number;

  @ApiProperty({ description: 'True if requester owns this job' })
  isOwner: boolean;
}

export class UserProfileJobsResponseDto {
  @ApiProperty({ type: [UserProfileJobDto] })
  data: UserProfileJobDto[];

  @ApiPropertyOptional({ description: 'Cursor for the next page' })
  nextCursor?: string | null;
}

