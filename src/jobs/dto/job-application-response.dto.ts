import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class JobApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  workerId: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiPropertyOptional()
  cvUrl?: string | null;

  @ApiProperty({ type: [String], description: 'Portfolio links submitted with the application' })
  portfolioLinks: string[];

  @ApiPropertyOptional({ description: 'Arbitrary metadata payload' })
  extraMetadata?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'Worker submission when status = SUBMITTED' })
  workSubmissionText?: string | null;

  @ApiPropertyOptional({ description: 'Escrow confirmation tx hash when confirmed' })
  confirmationTxHash?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

class JobSummaryForApplicationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  jobType: string;

  @ApiProperty()
  reward: number;

  @ApiProperty({ description: 'Current job status' })
  status: string;
}

export class JobApplicationWithJobDto extends JobApplicationResponseDto {
  @ApiProperty({ type: JobSummaryForApplicationDto })
  job: JobSummaryForApplicationDto;
}

class JobApplicantWorkerDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty()
  tier: string;
}

export class JobApplicationWithWorkerDto extends JobApplicationResponseDto {
  @ApiProperty({ type: JobApplicantWorkerDto })
  worker: JobApplicantWorkerDto;
}

