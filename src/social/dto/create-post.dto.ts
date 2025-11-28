import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  text!: string;

  @ApiPropertyOptional({ description: 'Optional IPFS CID if content stored off-chain' })
  @IsOptional()
  @IsString()
  ipfsCid?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Optional array of media URLs (binary uploads are pinned automatically)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      return [trimmed];
    }
    return undefined;
  })
  mediaUrls?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Inline image uploads handled separately',
  })
  @Allow()
  images?: unknown;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Inline attachment uploads handled separately',
  })
  @Allow()
  attachments?: unknown;
}
