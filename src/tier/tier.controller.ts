import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TierService } from './tier.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Tier')
@ApiBearerAuth('backend-jwt')
@Controller('tier')
export class TierController {
  constructor(private readonly tierService: TierService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve tier + history for current user' })
  @ApiOkResponse({ description: 'Tier name plus historical entries' })
  me(@CurrentUser() user: RequestUser) {
    return this.tierService.getMyTier(user.id);
  }
}
