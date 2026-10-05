import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { Role } from '../common/enums/role.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ArticlesService } from './articles.service.js';
import { ArticleResponseDto } from './dto/article-response.dto.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { ManageArticlesQueryDto } from './dto/manage-articles-query.dto.js';
import { PaginatedArticlesResponseDto } from './dto/paginated-articles-response.dto.js';
import { SearchArticlesQueryDto } from './dto/search-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';

const AUTHORING_ROLES = [Role.Moderator, Role.Admin];

// Static paths ('search', 'manage') are declared before ':slug' so they match first.
@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published articles' })
  @ApiOkResponse({ type: PaginatedArticlesResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  listPublished(
    @Query() query: ListArticlesQueryDto,
  ): Promise<PaginatedArticlesResponseDto> {
    return this.articlesService.listPublished(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search published articles by title and tags (partial match)',
    description:
      'Case-insensitive substring match: "სებას" finds "იოჰან სებასტიან ბახი". With several words, each must appear in the title or a tag. Newest first.',
  })
  @ApiOkResponse({ type: PaginatedArticlesResponseDto })
  @ApiBadRequestResponse({ description: 'Missing or invalid `q`' })
  search(
    @Query() query: SearchArticlesQueryDto,
  ): Promise<PaginatedArticlesResponseDto> {
    return this.articlesService.searchPublished(query);
  }

  @Get('manage')
  @Roles(...AUTHORING_ROLES)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List articles for editing, including drafts (moderators see their own, admins see all)',
  })
  @ApiOkResponse({ type: PaginatedArticlesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires the moderator or admin role' })
  listManaged(
    @Query() query: ManageArticlesQueryDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<PaginatedArticlesResponseDto> {
    return this.articlesService.listManaged(query, actor);
  }

  @Get('manage/:id')
  @Roles(...AUTHORING_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get any of your articles by id, including drafts' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not the author or an admin' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  findManaged(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.findManaged(params.id, actor);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a published article by slug' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiNotFoundResponse({ description: 'Article not found or not published' })
  findPublished(@Param('slug') slug: string): Promise<ArticleResponseDto> {
    return this.articlesService.findPublishedBySlug(slug);
  }

  @Post()
  @Roles(...AUTHORING_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an article (saved as a draft)' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, unknown category/image, or disallowed content',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires the moderator or admin role' })
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...AUTHORING_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an article (author or admin)' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, unknown category/image, or disallowed content',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not the author or an admin' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  update(
    @Param() params: ObjectIdParamDto,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.update(params.id, dto, actor);
  }

  @Delete(':id')
  @Roles(...AUTHORING_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an article (author or admin)' })
  @ApiNoContentResponse({ description: 'Article deleted' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not the author or an admin' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  remove(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    return this.articlesService.remove(params.id, actor);
  }

  @Post(':id/publish')
  @Roles(...AUTHORING_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Publish an article (author or admin)',
    description: 'Sets publishedAt on the first publish only.',
  })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not the author or an admin' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  publish(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.publish(params.id, actor);
  }

  @Post(':id/unpublish')
  @Roles(...AUTHORING_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Move an article back to draft (author or admin)' })
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Not the author or an admin' })
  @ApiNotFoundResponse({ description: 'Article not found' })
  unpublish(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.unpublish(params.id, actor);
  }
}
