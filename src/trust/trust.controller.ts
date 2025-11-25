import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrustService } from './trust.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Trust')
@ApiBearerAuth('backend-jwt')
@Controller('trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get('score')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get computed trust score for current user' })
  @ApiOkResponse({ description: 'Numeric trust score (0-1000)' })
  score(@CurrentUser() user: RequestUser) {
    return this.trustService.getScore(user.id);
  }
}
