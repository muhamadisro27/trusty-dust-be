import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TrustService } from './trust.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { TrustScoreResponseDto } from './dto/trust-score-response.dto';

@ApiTags('Trust')
@ApiBearerAuth('backend-jwt')
@Controller('trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get('score')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ trustScore: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Get computed trust score for current user' })
  @ApiOkResponse({ description: 'Numeric trust score (0-1000)', type: TrustScoreResponseDto })
  score(@CurrentUser() user: RequestUser) {
    return this.trustService.getScore(user.userId).then((trustScore) => ({ trustScore }));
  }
}
