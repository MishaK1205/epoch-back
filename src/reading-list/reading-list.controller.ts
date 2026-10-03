import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { PaginatedReadingListResponseDto } from './dto/paginated-reading-list-response.dto.js';
import { ReadingListType } from './enums/reading-list-type.enum.js';
import { ReadingListService } from './reading-list.service.js';

@ApiTags('reading-list')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@Controller('me')
export class ReadingListController {
  constructor(private readonly readingListService: ReadingListService) {}

  @Get('saved-articles')
  @ApiOperation({ summary: 'List your saved (read later) articles' })
  @ApiOkResponse({ type: PaginatedReadingListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  listSaved(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedReadingListResponseDto> {
    return this.readingListService.list(user.sub, ReadingListType.Saved, query);
  }

  @Put('saved-articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save a published article to read later' })
  @ApiNoContentResponse({ description: 'Saved (or already saved)' })
  @ApiBadRequestResponse({ description: 'Invalid article id' })
  @ApiNotFoundResponse({ description: 'Article not found or not published' })
  save(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.readingListService.add(
      user.sub,
      ReadingListType.Saved,
      params.id,
    );
  }

  @Delete('saved-articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an article from your saved articles' })
  @ApiNoContentResponse({ description: 'Removed (or was not saved)' })
  @ApiBadRequestResponse({ description: 'Invalid article id' })
  unsave(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.readingListService.remove(
      user.sub,
      ReadingListType.Saved,
      params.id,
    );
  }

  @Get('read-articles')
  @ApiOperation({ summary: 'List articles you marked as read' })
  @ApiOkResponse({ type: PaginatedReadingListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  listRead(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedReadingListResponseDto> {
    return this.readingListService.list(user.sub, ReadingListType.Read, query);
  }

  @Put('read-articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a published article as read' })
  @ApiNoContentResponse({ description: 'Marked as read (or already read)' })
  @ApiBadRequestResponse({ description: 'Invalid article id' })
  @ApiNotFoundResponse({ description: 'Article not found or not published' })
  markRead(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.readingListService.add(
      user.sub,
      ReadingListType.Read,
      params.id,
    );
  }

  @Delete('read-articles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark an article as unread' })
  @ApiNoContentResponse({ description: 'Unmarked (or was not marked)' })
  @ApiBadRequestResponse({ description: 'Invalid article id' })
  markUnread(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.readingListService.remove(
      user.sub,
      ReadingListType.Read,
      params.id,
    );
  }
}
