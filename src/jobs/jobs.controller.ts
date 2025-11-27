import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { SubmitWorkDto } from './dto/submit-work.dto';
import { ConfirmWorkDto } from './dto/confirm-work.dto';
import { SearchJobsQueryDto } from './dto/search-jobs.dto';
import { MyApplicationsQueryDto } from './dto/my-applications-query.dto';
import {
  JobApplicationResponseDto,
  JobApplicationWithJobDto,
  JobApplicationWithWorkerDto,
} from './dto/job-application-response.dto';
import {
  JobResponseDto,
  JobSearchItemDto,
  JobSearchResponseDto,
  JobWithMetaDto,
} from './dto/job-response.dto';

@ApiTags('Jobs')
@ApiBearerAuth('backend-jwt')
@Controller('jobs')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('me')
  @Throttle({ jobsList: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List jobs created by current user' })
  @ApiOkResponse({
    description: 'Array of job postings owned by the requester',
    type: [JobWithMetaDto],
  })
  listMyJobs(@CurrentUser() user: RequestUser) {
    return this.jobsService.listMyJobs(user.userId);
  }

  @Get('applications/me')
  @Throttle({ jobsMyApplications: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List applications submitted by the current user' })
  @ApiOkResponse({
    description: 'Array of applications with related job meta',
    type: [JobApplicationWithJobDto],
  })
  listMyApplications(
    @CurrentUser() user: RequestUser,
    @Query() query: MyApplicationsQueryDto,
  ) {
    return this.jobsService.listMyApplications(user.userId, query.limit);
  }

  @Get(':id/applicants')
  @Throttle({ jobsApplicants: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List applicants for a job owned by the current user' })
  @ApiOkResponse({ description: 'Array of job applications for the job', type: [JobApplicationWithWorkerDto] })
  @ApiBadRequestResponse({ description: 'Requester is not the job owner' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  listApplicants(@CurrentUser() user: RequestUser, @Param('id') jobId: string) {
    return this.jobsService.listApplicants(jobId, user.userId);
  }

  @Get('search')
  @Throttle({ jobsSearch: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'Search open jobs' })
  @ApiOkResponse({ type: JobSearchResponseDto })
  searchJobs(@Query() query: SearchJobsQueryDto) {
    return this.jobsService.searchJobs(query);
  }

  @Get('hot')
  @Throttle({ jobsHot: { limit: 30, ttl: 60 } })
  @ApiOperation({ summary: 'Top open jobs ordered by reward/applications' })
  @ApiOkResponse({ type: [JobSearchItemDto] })
  hotJobs() {
    return this.jobsService.hotJobs(4);
  }

  @Post('create')
  @Throttle({ jobsCreate: { limit: 10, ttl: 300 } })
  @ApiOperation({ summary: 'Create job, burn DUST, and lock escrow' })
  @ApiBody({ type: CreateJobDto })
  @ApiCreatedResponse({ description: 'Job record created', type: JobResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or proof missing' })
  @ApiNotFoundResponse({ description: 'Creator user not found' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(user.userId, dto);
  }

  @Post(':id/apply')
  @Throttle({ jobsApply: { limit: 30, ttl: 300 } })
  @ApiOperation({ summary: 'Apply to a job with ZK proof and DUST burn' })
  @ApiBody({ type: ApplyJobDto })
  @ApiOkResponse({ description: 'Application created', type: JobApplicationResponseDto })
  @ApiBadRequestResponse({ description: 'Already applied or applying to own job' })
  @ApiNotFoundResponse({ description: 'Job unavailable' })
  apply(@CurrentUser() user: RequestUser, @Param('id') jobId: string, @Body() dto: ApplyJobDto) {
    return this.jobsService.apply(jobId, user.userId, dto);
  }

  @Post('application/:id/submit')
  @Throttle({ jobsSubmit: { limit: 30, ttl: 300 } })
  @ApiOperation({ summary: 'Submit work for an accepted application' })
  @ApiBody({ type: SubmitWorkDto })
  @ApiOkResponse({ description: 'Application updated to SUBMITTED', type: JobApplicationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid state transition' })
  @ApiNotFoundResponse({ description: 'Application not found for requester' })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id') applicationId: string,
    @Body() dto: SubmitWorkDto,
  ) {
    return this.jobsService.submit(applicationId, user.userId, dto);
  }

  @Post('application/:id/confirm')
  @Throttle({ jobsConfirm: { limit: 30, ttl: 300 } })
  @ApiOperation({ summary: 'Poster confirms work and releases escrow' })
  @ApiBody({ type: ConfirmWorkDto })
  @ApiOkResponse({ description: 'Application updated to CONFIRMED', type: JobApplicationResponseDto })
  @ApiBadRequestResponse({ description: 'Work must be submitted before confirmation' })
  @ApiNotFoundResponse({ description: 'Application or job not found' })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id') applicationId: string,
    @Body() dto: ConfirmWorkDto,
  ) {
    return this.jobsService.confirm(applicationId, user.userId, dto);
  }
}
