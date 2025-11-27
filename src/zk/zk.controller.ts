import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZkService } from './zk.service';
import { GenerateScoreProofDto } from './dto/generate-score-proof.dto';
import { VerifyCalldataDto } from './dto/verify-calldata.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZkProofResponseDto } from './dto/zk-proof-response.dto';
import { VerifyProofResponseDto } from './dto/verify-proof-response.dto';

@ApiTags('Zero Knowledge')
@ApiBearerAuth('backend-jwt')
@Controller('zk')
export class ZkController {
  constructor(private readonly zkService: ZkService) {}

  @Post('generate')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ zkGenerate: { limit: 5, ttl: 60 } })
  @ApiOperation({ summary: 'Generate Noir score proof from backend inputs' })
  @ApiBody({ type: GenerateScoreProofDto })
  @ApiCreatedResponse({
    description: 'Proof and public inputs ready for on-chain verification',
    type: ZkProofResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or failed prover run' })
  generate(@Body() dto: GenerateScoreProofDto) {
    return this.zkService.generateScoreProof(dto);
  }

  @Post('verify')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ zkVerify: { limit: 30, ttl: 60 } })
  @ApiOperation({ summary: 'Verify Noir proof against TrustVerification contract' })
  @ApiBody({ type: VerifyCalldataDto })
  @ApiOkResponse({ description: 'Boolean verification result', type: VerifyProofResponseDto })
  @ApiBadRequestResponse({ description: 'On-chain verifier rejected the proof' })
  verify(@Body() dto: VerifyCalldataDto) {
    return this.zkService.verifyOnChain(dto);
  }
}
