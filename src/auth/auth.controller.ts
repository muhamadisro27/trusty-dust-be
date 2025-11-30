import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginByWalletDto } from './dto/login-by-wallet.dto';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginResponseDto } from './dto/login-response.dto';
import { UsersService } from '../users/users.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @Throttle({ auth: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Verify Privy token and mint backend JWT' })
  @ApiBody({ type: LoginByWalletDto, required: true })
  @ApiOkResponse({
    description: 'JWT plus user profile that will be used across endpoints',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Payload validation failed' })
  @ApiUnauthorizedResponse({ description: 'Signature or timestamp invalid' })
  @Post('login')
  async loginByWallet(@Body() dto: LoginByWalletDto): Promise<LoginResponseDto> {
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

    // Get user with dustBalance using UsersService
    const userWithBalance = await this.usersService.findById(user.id);
    if (!userWithBalance) {
      throw new UnauthorizedException('Failed to fetch user profile');
    }

    return {
      jwt: this.jwtService.sign({
        sub: user.id,
        walletAddress: walletAddress,
      }),
      data: userWithBalance,
    };
  }
}
