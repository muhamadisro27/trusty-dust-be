import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchPeopleQueryDto } from './dto/search-people.dto';
import { ProfileFeedQueryDto } from './dto/profile-feed-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';
import { UserSuggestionDto } from './dto/user-suggestion.dto';
import { SuccessResponseDto } from './dto/success-response.dto';
import { UserPublicProfileDto } from './dto/user-public-profile.dto';
import { UserProfilePostsResponseDto } from './dto/user-profile-posts.dto';
import { UserProfileJobsResponseDto } from './dto/user-profile-jobs.dto';

@ApiTags('Users')
@ApiBearerAuth('backend-jwt')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fetch current user profile' })
  @ApiOkResponse({ description: 'Returns user profile persisted in DB', type: UserResponseDto })
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.findById(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update username and avatar' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'Updated user record', type: UserResponseDto })
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get('search/people')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersSearchPeople: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'Search people by keyword, title, or job type' })
  @ApiOkResponse({ description: 'Paginated list of people', type: UserSearchResponseDto })
  searchPeople(@CurrentUser() user: RequestUser, @Query() query: SearchPeopleQueryDto) {
    return this.usersService.searchPeople(user.userId, query);
  }

  @Get('suggested')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersSuggested: { limit: 30, ttl: 60 } })
  @ApiOperation({ summary: 'Suggested people with similar tier/job type' })
  @ApiOkResponse({ type: [UserSuggestionDto] })
  suggested(@CurrentUser() user: RequestUser) {
    return this.usersService.suggestedPeople(user.userId);
  }

  @Post(':id/follow')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersFollow: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Follow a user' })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiBadRequestResponse({ description: 'Cannot follow yourself' })
  @ApiNotFoundResponse({ description: 'Target user not found' })
  follow(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    return this.usersService.followUser(user.userId, targetId);
  }

  @Delete(':id/follow')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersFollow: { limit: 120, ttl: 60 } })
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiOkResponse({ type: SuccessResponseDto })
  unfollow(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    return this.usersService.unfollowUser(user.userId, targetId);
  }
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get public profile for another user' })
  @ApiOkResponse({ type: UserPublicProfileDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  profile(@CurrentUser() user: RequestUser, @Param('id') targetId: string) {
    return this.usersService.getPublicProfile(user.userId, targetId);
  }

  @Get(':id/posts')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersProfilePosts: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List posts authored by target user' })
  @ApiOkResponse({ type: UserProfilePostsResponseDto })
  listProfilePosts(
    @CurrentUser() user: RequestUser,
    @Param('id') targetId: string,
    @Query() query: ProfileFeedQueryDto,
  ) {
    return this.usersService.listUserPosts(user.userId, targetId, query);
  }

  @Get(':id/jobs')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ usersProfileJobs: { limit: 60, ttl: 60 } })
  @ApiOperation({ summary: 'List jobs posted by target user' })
  @ApiOkResponse({ type: UserProfileJobsResponseDto })
  listProfileJobs(
    @CurrentUser() user: RequestUser,
    @Param('id') targetId: string,
    @Query() query: ProfileFeedQueryDto,
  ) {
    return this.usersService.listUserJobs(targetId, query, user.userId);
  }
}
