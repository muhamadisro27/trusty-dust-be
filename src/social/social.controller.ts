import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreatePostDto } from './dto/create-post.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { BoostPostDto } from './dto/boost-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostDetailQueryDto } from './dto/post-detail-query.dto';

@ApiTags('Social')
@ApiBearerAuth('backend-jwt')
@Controller('social')
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('posts')
  @Throttle({ socialFeed: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Retrieve paginated social feed' })
  @ApiOkResponse({ description: 'List of posts with reaction counts and previews' })
  listPosts(@CurrentUser() user: RequestUser, @Query() query: ListPostsQueryDto) {
    return this.socialService.listPosts(user.userId, query);
  }

  @Get('posts/:id')
  @Throttle({ socialPostDetail: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Retrieve single post with comments' })
  @ApiOkResponse({ description: 'Post detail plus comments' })
  getPost(
    @CurrentUser() user: RequestUser,
    @Param('id') postId: string,
    @Query() query: PostDetailQueryDto,
  ) {
    return this.socialService.getPostDetail(user.userId, postId, query);
  }

  @Post('posts')
  @Throttle({ socialPost: { limit: 20, ttl: 60 } })
  @ApiOperation({ summary: 'Create post and earn DUST reward' })
  @ApiCreatedResponse({ description: 'Returns created post with media records' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.socialService.createPost(user.userId, dto);
  }

  @Post('posts/:id/react')
  @Throttle({ socialReact: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'React (like/comment/repost) to a post' })
  @ApiOkResponse({ description: 'Reaction created' })
  react(
    @CurrentUser() user: RequestUser,
    @Param('id') postId: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.socialService.reactToPost(user.userId, postId, dto);
  }

  @Post('posts/:id/boost')
  @Throttle({ socialBoost: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Spend DUST to boost a post' })
  @ApiOkResponse({ description: 'Boost ledger entry' })
  boost(
    @CurrentUser() user: RequestUser,
    @Param('id') postId: string,
    @Body() dto: BoostPostDto,
  ) {
    return this.socialService.boostPost(user.userId, postId, dto);
  }
}
