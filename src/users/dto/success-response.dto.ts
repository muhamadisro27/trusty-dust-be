import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({ description: 'Indicates whether the operation succeeded' })
  success: boolean;
}

