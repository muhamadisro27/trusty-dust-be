import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialMediaDto } from './social-media.dto';

export class PostWithMediaDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional()
  ipfsCid?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [SocialMediaDto] })
  media: SocialMediaDto[];
}

