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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateWhatWhereWhenCategoryDto } from './dto/create-what-where-when-category.dto.js';
import { UpdateWhatWhereWhenCategoryDto } from './dto/update-what-where-when-category.dto.js';
import { WhatWhereWhenCategoryResponseDto } from './dto/what-where-when-category-response.dto.js';
import { WhatWhereWhenCategoriesService } from './what-where-when-categories.service.js';

@ApiTags('what-where-when')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Requires the admin role' })
@Roles(Role.Admin)
@Controller('what-where-when-categories')
export class WhatWhereWhenCategoriesController {
  constructor(
    private readonly categoriesService: WhatWhereWhenCategoriesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List What? Where? When? categories by name, with package counts (admin only)',
  })
  @ApiOkResponse({ type: [WhatWhereWhenCategoryResponseDto] })
  list(): Promise<WhatWhereWhenCategoryResponseDto[]> {
    return this.categoriesService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a What? Where? When? category (admin only)' })
  @ApiOkResponse({ type: WhatWhereWhenCategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(
    @Param() params: ObjectIdParamDto,
  ): Promise<WhatWhereWhenCategoryResponseDto> {
    return this.categoriesService.findOne(params.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a What? Where? When? category (admin only)',
  })
  @ApiCreatedResponse({ type: WhatWhereWhenCategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  create(
    @Body() dto: CreateWhatWhereWhenCategoryDto,
  ): Promise<WhatWhereWhenCategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a What? Where? When? category (admin only)',
  })
  @ApiOkResponse({ type: WhatWhereWhenCategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  update(
    @Param() params: ObjectIdParamDto,
    @Body() dto: UpdateWhatWhereWhenCategoryDto,
  ): Promise<WhatWhereWhenCategoryResponseDto> {
    return this.categoriesService.update(params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a What? Where? When? category; fails while packages use it (admin only)',
  })
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Category is used by packages' })
  remove(@Param() params: ObjectIdParamDto): Promise<void> {
    return this.categoriesService.remove(params.id);
  }
}
