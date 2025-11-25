import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { SubmitWorkDto } from './dto/submit-work.dto';
import { ConfirmWorkDto } from './dto/confirm-work.dto';

@ApiTags('Jobs')
@ApiBearerAuth('backend-jwt')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create job, burn DUST, and lock escrow' })
  @ApiCreatedResponse({ description: 'Job record created' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(user.id, dto);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply to a job with ZK proof and DUST burn' })
  @ApiOkResponse({ description: 'Application created' })
  apply(@CurrentUser() user: RequestUser, @Param('id') jobId: string, @Body() dto: ApplyJobDto) {
    return this.jobsService.apply(jobId, user.id, dto);
  }

  @Post('application/:id/submit')
  @ApiOperation({ summary: 'Submit work for an accepted application' })
  @ApiOkResponse({ description: 'Application updated to SUBMITTED' })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id') applicationId: string,
    @Body() dto: SubmitWorkDto,
  ) {
    return this.jobsService.submit(applicationId, user.id, dto);
  }

  @Post('application/:id/confirm')
  @ApiOperation({ summary: 'Poster confirms work and releases escrow' })
  @ApiOkResponse({ description: 'Application updated to CONFIRMED' })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id') applicationId: string,
    @Body() dto: ConfirmWorkDto,
  ) {
    return this.jobsService.confirm(applicationId, user.id, dto);
  }
}
