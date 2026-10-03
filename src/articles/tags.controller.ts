import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { ArticlesService } from './articles.service.js';
import { ListTagsQueryDto } from './dto/list-tags-query.dto.js';
import { TagResponseDto } from './dto/tag-response.dto.js';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List tags used by published articles, most used first',
  })
  @ApiOkResponse({ type: [TagResponseDto] })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  list(@Query() query: ListTagsQueryDto): Promise<TagResponseDto[]> {
    return this.articlesService.listTags(query);
  }
}
