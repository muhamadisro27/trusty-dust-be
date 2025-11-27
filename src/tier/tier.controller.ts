import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TierService } from './tier.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { TierResponseDto } from './dto/tier-response.dto';

@ApiTags('Tier')
@ApiBearerAuth('backend-jwt')
@Controller('tier')
export class TierController {
  constructor(private readonly tierService: TierService) {}

  @Get('me')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ tierMe: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Retrieve tier + history for current user' })
  @ApiOkResponse({ description: 'Tier name plus historical entries', type: TierResponseDto })
  me(@CurrentUser() user: RequestUser) {
    return this.tierService.getMyTier(user.userId);
  }
}
