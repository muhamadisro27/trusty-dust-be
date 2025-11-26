import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByWalletDto {
  @ApiProperty({
    type: String,
    description: 'wallet address of user',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
  @ApiProperty({
    type: String,
    description: 'signed message',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
  @ApiProperty({
    type: String,
    description: 'message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
