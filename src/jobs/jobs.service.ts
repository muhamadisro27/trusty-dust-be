import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { EscrowService } from '../escrow/escrow.service';
import { ZkService } from '../zk/zk.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { SubmitWorkDto } from './dto/submit-work.dto';
import { ConfirmWorkDto } from './dto/confirm-work.dto';
import { SearchJobsQueryDto } from './dto/search-jobs.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly dustService: DustService,
    private readonly trustService: TrustService,
    private readonly escrowService: EscrowService,
    private readonly zkService: ZkService,
    private readonly notificationService: NotificationService,
  ) {}

  async createJob(userId: string, dto: CreateJobDto) {
    if (
      dto.salaryMin !== undefined &&
      dto.salaryMax !== undefined &&
      dto.salaryMin > dto.salaryMax
    ) {
      throw new BadRequestException('salaryMin cannot exceed salaryMax');
    }

    await this.zkService.assertProof(userId, dto.minTrustScore, dto.zkProofId);
    await this.dustService.spendDust(userId, 50, 'job_create');
    this.logger.log(`User ${userId} creating job ${dto.title}`);
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!creator) {
      throw new NotFoundException('User missing');
    }

    const normalizedRequirements =
      dto.requirements
        ?.map((req) => req.trim())
        .filter((req) => req.length > 0) ?? [];

    const job = await this.prisma.job.create({
      data: {
        creatorId: userId,
        title: dto.title,
        description: dto.description,
        companyName: dto.companyName,
        companyLogo: dto.companyLogo,
        location: dto.location,
        jobType: dto.jobType,
        requirements: normalizedRequirements,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        closeAt: dto.closeAt ? new Date(dto.closeAt) : undefined,
        minTrustScore: dto.minTrustScore,
        reward: dto.reward,
        status: 'OPEN',
      },
    });

    await this.escrowService.lock(
      job.id,
      job.chainRef,
      creator.walletAddress,
      creator.walletAddress,
      dto.reward,
    );
    await this.notificationService.notify(
      userId,
      'Job created and escrow locked',
    );
    this.logger.log(`Job ${job.id} created by ${userId}`);
    return job;
  }

  async listMyJobs(userId: string) {
    return this.prisma.job.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        applications: {
          select: { id: true, status: true, workerId: true },
        },
        escrow: true,
      },
    });
  }

  async listApplicants(jobId: string, requesterId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { creatorId: true },
    });
    if (!job) {
      throw new NotFoundException('Job missing');
    }
    if (job.creatorId !== requesterId) {
      throw new BadRequestException('Only job owner can view applicants');
    }

    return this.prisma.jobApplication.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        worker: {
          select: { id: true, username: true, walletAddress: true, tier: true },
        },
      },
    });
  }

  async searchJobs(query: SearchJobsQueryDto) {
    const take = Math.min(parseInt(query.limit ?? '20', 10) || 20, 50);
    const cursorOptions = query.cursor
      ? { cursor: { id: query.cursor }, skip: 1 }
      : undefined;

    const where: Prisma.JobWhereInput = {
      status: JobStatus.OPEN,
    };

    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: 'insensitive' } },
        { companyName: { contains: query.keyword, mode: 'insensitive' } },
        { description: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.jobType) {
      where.jobType = { equals: query.jobType, mode: 'insensitive' };
    }
    if (query.jobTitle) {
      where.title = { contains: query.jobTitle, mode: 'insensitive' };
    }

    const results = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursorOptions ?? {}),
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: {
          select: { applications: true },
        },
      },
    });

    const hasNext = results.length > take;
    const data = results.slice(0, take);
    return {
      data,
      nextCursor: hasNext ? (data.at(-1)?.id ?? null) : null,
    };
  }

  async hotJobs(limit = 4) {
    return this.prisma.job.findMany({
      where: { status: JobStatus.OPEN },
      orderBy: [
        { reward: 'desc' },
        { applications: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { applications: true } },
      },
    });
  }

  async apply(jobId: string, userId: string, dto: ApplyJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (job?.status !== 'OPEN') {
      throw new NotFoundException('Job unavailable');
    }
    if (job.creatorId === userId) {
      throw new BadRequestException('Cannot apply to your own job');
    }

    await this.zkService.assertProof(userId, job.minTrustScore, dto.zkProofId);
    await this.dustService.spendDust(userId, 20, 'job_apply');
    this.logger.log(`User ${userId} applying to job ${jobId}`);

    const existing = await this.prisma.jobApplication.findFirst({
      where: { jobId, workerId: userId },
    });
    if (existing) {
      throw new BadRequestException('Already applied');
    }

    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        workerId: userId,
        status: 'APPLIED',
      },
    });

    await this.notificationService.notify(
      job.creatorId,
      'New job application received',
    );
    return application;
  }

  async submit(applicationId: string, userId: string, dto: SubmitWorkDto) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (application?.workerId !== userId) {
      throw new NotFoundException('Application missing');
    }
    if (application.status !== 'APPLIED') {
      throw new BadRequestException('Invalid state for submission');
    }

    const updated = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'SUBMITTED', workSubmissionText: dto.workSubmissionText },
    });

    const job = await this.prisma.job.findUnique({
      where: { id: application.jobId },
    });
    if (job) {
      await this.notificationService.notify(
        job.creatorId,
        'Work submitted for review',
      );
    }
    this.logger.log(`Application ${applicationId} submitted by ${userId}`);
    return updated;
  }

  async confirm(applicationId: string, userId: string, dto: ConfirmWorkDto) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException('Application missing');
    }
    const job = await this.prisma.job.findUnique({
      where: { id: application.jobId },
    });
    if (job?.creatorId !== userId) {
      throw new NotFoundException('Job missing or unauthorized');
    }
    if (application.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Work must be submitted before confirmation',
      );
    }

    const updatedApplication = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: 'CONFIRMED', confirmationTxHash: dto.txHash },
    });

    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED' },
    });
    await this.escrowService.release(job.id, job.chainRef);
    await this.notificationService.notify(
      application.workerId,
      'Payment released for your job',
    );
    await this.trustService.recordEvent(
      application.workerId,
      'job_completed',
      100,
    );
    this.logger.log(
      `Application ${applicationId} confirmed by poster ${userId}`,
    );

    return updatedApplication;
  }
}
