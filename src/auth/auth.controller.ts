import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginByWalletDto } from './dto/login-by-wallet.dto';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Throttle({ auth: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Verify Privy token and mint backend JWT' })
  @ApiBody({ type: LoginByWalletDto, required: false })
  @ApiOkResponse({ description: 'Backend JWT plus user profile' })
  @Post('login')
  async loginByWallet(@Body() dto: LoginByWalletDto): Promise<any> {
    console.log(dto);
    const walletAddress = dto.walletAddress.toLowerCase();
    const invalidReason = await this.authService.verifySignature(dto);
    if (invalidReason) {
      throw new UnauthorizedException(invalidReason);
    }

    let user: User;

    const findWallet = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress },
    });

    if (findWallet) {
      user = findWallet;
    } else {
      user = await this.prisma.user.create({
        data: {
          walletAddress,
        },
      });
    }

    return {
      jwt: this.jwtService.sign({
        sub: user.id,
        walletAddress: walletAddress,
      }),
      data: user,
    };
  }
}
