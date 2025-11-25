import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZkService } from './zk.service';
import { GenerateScoreProofDto } from './dto/generate-score-proof.dto';
import { VerifyCalldataDto } from './dto/verify-calldata.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Zero Knowledge')
@ApiBearerAuth('backend-jwt')
@Controller('zk')
export class ZkController {
  constructor(private readonly zkService: ZkService) {}

  @Post('generate')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ zkGenerate: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Generate Noir score proof from backend inputs' })
  @ApiCreatedResponse({ description: 'Proof and public inputs ready for on-chain verification' })
  generate(@Body() dto: GenerateScoreProofDto) {
    return this.zkService.generateScoreProof(dto);
  }

  @Post('verify')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ zkVerify: { limit: 30, ttl: 60 } })
  @ApiOperation({ summary: 'Verify Noir proof against TrustVerification contract' })
  @ApiOkResponse({ description: 'Boolean verification result' })
  verify(@Body() dto: VerifyCalldataDto) {
    return this.zkService.verifyOnChain(dto);
  }
}
