import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PrivyAuthGuard } from '../common/guards/privy-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(PrivyAuthGuard)
  @ApiBearerAuth('privy')
  @ApiOperation({ summary: 'Verify Privy token and mint backend JWT' })
  @ApiBody({ type: LoginDto, required: false })
  @ApiOkResponse({ description: 'Backend JWT plus user profile' })
  async login(@Body() body: LoginDto, @Req() req: any) {
    if (req?.privyUser) {
      return this.authService.issueBackendToken(req.privyUser);
    }

    if (!body.privyToken) {
      throw new BadRequestException('Privy token required');
    }
    return this.authService.loginWithPrivyToken(body.privyToken);
  }
}
