import { Controller, Get, Param, ParseIntPipe, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WalletReputationService } from './wallet-reputation.service';
import { AnalyzeWalletDto } from './dto/analyze-wallet.dto';

@ApiTags('Wallet Reputation')
@ApiBearerAuth('backend-jwt')
@UseGuards(JwtAuthGuard)
@Controller('wallet-reputation')
export class WalletReputationController {
  constructor(private readonly service: WalletReputationService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze wallet reputation using on-chain heuristics' })
  @ApiOkResponse({ description: 'Reputation snapshot stored' })
  analyze(@Body() dto: AnalyzeWalletDto) {
    return this.service.analyzeWallet(dto);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get latest wallet reputation snapshot' })
  @ApiOkResponse({ description: 'Wallet reputation entry' })
  getLatest(@Param('address') address: string, @Query('chainId', ParseIntPipe) chainId: number) {
    return this.service.getLatest(address, chainId);
  }
}
