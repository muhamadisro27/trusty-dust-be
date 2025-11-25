import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreatePostDto } from './dto/create-post.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { BoostPostDto } from './dto/boost-post.dto';

@ApiTags('Social')
@ApiBearerAuth('backend-jwt')
@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('posts')
  @ApiOperation({ summary: 'Create post and earn DUST reward' })
  @ApiCreatedResponse({ description: 'Returns created post with media records' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.socialService.createPost(user.id, dto);
  }

  @Post('posts/:id/react')
  @ApiOperation({ summary: 'React (like/comment/repost) to a post' })
  @ApiOkResponse({ description: 'Reaction created' })
  react(
    @CurrentUser() user: RequestUser,
    @Param('id') postId: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.socialService.reactToPost(user.id, postId, dto);
  }

  @Post('posts/:id/boost')
  @ApiOperation({ summary: 'Spend DUST to boost a post' })
  @ApiOkResponse({ description: 'Boost ledger entry' })
  boost(
    @CurrentUser() user: RequestUser,
    @Param('id') postId: string,
    @Body() dto: BoostPostDto,
  ) {
    return this.socialService.boostPost(user.id, postId, dto);
  }
}
