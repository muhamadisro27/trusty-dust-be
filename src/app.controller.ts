import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Simple heartbeat endpoint' })
  @ApiOkResponse({ description: 'Returns service status and timestamp' })
  getStatus() {
    return this.appService.getStatus();
  }
}
