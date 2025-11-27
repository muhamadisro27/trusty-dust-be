import { ApiProperty } from '@nestjs/swagger';

export class SocialMediaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postId: string;

  @ApiProperty()
  url: string;
}

