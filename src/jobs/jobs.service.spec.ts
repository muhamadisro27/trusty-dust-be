import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { EscrowService } from '../escrow/escrow.service';
import { ZkService } from '../zk/zk.service';
import { NotificationService } from '../notifications/notification.service';

describe('JobsService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    job: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    jobApplication: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const dust = { spendDust: jest.fn() } as unknown as DustService;
  const trust = { recordEvent: jest.fn() } as unknown as TrustService;
  const escrow = { lock: jest.fn(), release: jest.fn() } as unknown as EscrowService;
  const zk = { assertProof: jest.fn() } as unknown as ZkService;
  const notification = { notify: jest.fn() } as unknown as NotificationService;

  let service: JobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobsService(prisma, dust, trust, escrow, zk, notification);
  });

  const createJobPayload = () =>
    ({
      title: 'job',
      description: 'desc',
      companyName: 'TrustyDust',
      companyLogo: 'https://cdn/logo.png',
      location: 'Remote',
      jobType: 'Contract',
      requirements: ['Figma'],
      minTrustScore: 100,
      reward: 20,
      salaryMin: 80,
      salaryMax: 150,
      closeAt: '2030-01-01T00:00:00.000Z',
    }) as any;

  describe('createJob', () => {
    it('throws when salary min greater than max', async () => {
      await expect(
        service.createJob(
          'user',
          {
            ...createJobPayload(),
            salaryMin: 200,
            salaryMax: 100,
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when creator missing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createJob('user', createJobPayload()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('asserts proof, spends dust, creates job, locks escrow, notifies', async () => {
      const dto = createJobPayload();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user', walletAddress: '0xabc' });
      (prisma.job.create as jest.Mock).mockResolvedValue({ id: 'job', chainRef: 5 });

      const job = await service.createJob('user', dto);

      expect(zk.assertProof).toHaveBeenCalledWith('user', 100, undefined);
      expect(dust.spendDust).toHaveBeenCalledWith('user', 50, 'job_create');
      expect(prisma.job.create).toHaveBeenCalled();
      expect(escrow.lock).toHaveBeenCalledWith('job', 5, '0xabc', '0xabc', 20);
      expect(notification.notify).toHaveBeenCalledWith('user', 'Job created and escrow locked');
      expect(job).toEqual({ id: 'job', chainRef: 5 });
    });
  });

  describe('apply', () => {
    it('throws when job missing or closed', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.apply('job', 'user', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when applying own job', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'user', status: 'OPEN' });
      await expect(service.apply('job', 'user', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when already applied', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'poster', status: 'OPEN', minTrustScore: 300 });
      (prisma.jobApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.apply('job', 'user', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('asserts proof, spends dust, creates application, notifies poster', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'poster', status: 'OPEN', minTrustScore: 200 });
      (prisma.jobApplication.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.jobApplication.create as jest.Mock).mockResolvedValue({ id: 'application' });

      const application = await service.apply('job', 'user', {} as any);
      expect(zk.assertProof).toHaveBeenCalledWith('user', 200, undefined);
      expect(dust.spendDust).toHaveBeenCalledWith('user', 20, 'job_apply');
      expect(notification.notify).toHaveBeenCalledWith('poster', 'New job application received');
      expect(application).toEqual({ id: 'application' });
    });
  });

  describe('submit', () => {
    it('throws when application missing or not owner', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.submit('app', 'user', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when status not APPLIED', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({ workerId: 'user', status: 'SUBMITTED' });
      await expect(service.submit('app', 'user', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates application to SUBMITTED and notifies poster', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app',
        workerId: 'user',
        status: 'APPLIED',
        jobId: 'job',
      });
      (prisma.jobApplication.update as jest.Mock).mockResolvedValue({ id: 'app', status: 'SUBMITTED' });
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'poster' });

      const dto = { workSubmissionText: 'done' } as any;
      const result = await service.submit('app', 'user', dto);
      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: 'app' },
        data: { status: 'SUBMITTED', workSubmissionText: 'done' },
      });
      expect(notification.notify).toHaveBeenCalledWith('poster', 'Work submitted for review');
      expect(result).toEqual({ id: 'app', status: 'SUBMITTED' });
    });
  });

  describe('confirm', () => {
    it('throws when application missing', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.confirm('app', 'poster', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when job missing or unauthorized', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({ jobId: 'job' });
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'other' });
      await expect(service.confirm('app', 'poster', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when status not SUBMITTED', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({ jobId: 'job', status: 'APPLIED' });
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ creatorId: 'poster' });
      await expect(service.confirm('app', 'poster', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates application/job, releases escrow, notifies worker, records trust event', async () => {
      (prisma.jobApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app',
        jobId: 'job',
        workerId: 'worker',
        status: 'SUBMITTED',
      });
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ id: 'job', creatorId: 'poster', chainRef: 7 });
      (prisma.jobApplication.update as jest.Mock).mockResolvedValue({ id: 'app', status: 'CONFIRMED' });

      const result = await service.confirm('app', 'poster', { txHash: '0xtx' } as any);

      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: 'app' },
        data: { status: 'CONFIRMED', confirmationTxHash: '0xtx' },
      });
      expect(prisma.job.update).toHaveBeenCalledWith({ where: { id: 'job' }, data: { status: 'COMPLETED' } });
      expect(escrow.release).toHaveBeenCalledWith('job', 7);
      expect(notification.notify).toHaveBeenCalledWith('worker', 'Payment released for your job');
      expect(trust.recordEvent).toHaveBeenCalledWith('worker', 'job_completed', 100);
      expect(result).toEqual({ id: 'app', status: 'CONFIRMED' });
    });
  });
});
