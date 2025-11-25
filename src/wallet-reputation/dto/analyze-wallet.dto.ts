import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsInt, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';

export class AnalyzeWalletDto {
  @ApiProperty({ description: 'Wallet address to analyze' })
  @IsString()
  @IsEthereumAddress()
  address!: string;

  @ApiProperty({ description: 'Chain ID to reference (e.g. 1 for Ethereum mainnet)' })
  @IsInt()
  @Min(1)
  chainId!: number;

  @ApiProperty({ required: false, description: 'Optional user ID to link the reputation entry' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string;
}
