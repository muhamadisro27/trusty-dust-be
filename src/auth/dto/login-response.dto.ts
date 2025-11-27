import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ description: 'Backend JWT to authenticate future requests' })
  jwt: string;

  @ApiProperty({ description: 'User profile that was found or created', type: UserResponseDto })
  data: UserResponseDto;
}

