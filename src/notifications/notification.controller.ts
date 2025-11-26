import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Notifications')
@ApiBearerAuth('backend-jwt')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ notificationsList: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List stored notifications for user' })
  @ApiOkResponse({ description: 'List of notifications sorted desc' })
  list(@CurrentUser() user: RequestUser) {
    return this.notificationService.list(user.userId);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiOkResponse({ description: 'Updated notification entry' })
  markAsRead(@CurrentUser() user: RequestUser, @Param('id') notificationId: string) {
    return this.notificationService.markAsRead(user.userId, notificationId);
  }
}
