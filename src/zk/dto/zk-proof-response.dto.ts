import { ApiProperty } from '@nestjs/swagger';

export class ZkProofResponseDto {
  @ApiProperty({ description: 'Serialized proof bytes in hex/base64' })
  proof: string;

  @ApiProperty({ type: [String], description: 'Public inputs for verifier contract' })
  publicInputs: string[];

  @ApiProperty({ description: 'Identifier of the persisted proof record' })
  proofId: string;
}

