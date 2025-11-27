import { ApiProperty } from '@nestjs/swagger';

export class VerifyProofResponseDto {
  @ApiProperty({ description: 'True when on-chain verification succeeded' })
  valid: boolean;
}

