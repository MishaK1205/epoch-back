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
import { Roles } from '../common/decorators/roles.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateWhatWhereWhenDto } from './dto/create-what-where-when.dto.js';
import { ListWhatWhereWhenQueryDto } from './dto/list-what-where-when-query.dto.js';
import { PaginatedWhatWhereWhenResponseDto } from './dto/paginated-what-where-when-response.dto.js';
import { UpdateWhatWhereWhenDto } from './dto/update-what-where-when.dto.js';
import { WhatWhereWhenResponseDto } from './dto/what-where-when-response.dto.js';
import { WhatWhereWhenService } from './what-where-when.service.js';

@ApiTags('what-where-when')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Requires the admin role' })
@Roles(Role.Admin)
@Controller('what-where-when')
export class WhatWhereWhenController {
  constructor(private readonly whatWhereWhenService: WhatWhereWhenService) {}

  @Get()
  @ApiOperation({
    summary:
      'List What? Where? When? packages, newest date first, without questions (admin only)',
  })
  @ApiOkResponse({ type: PaginatedWhatWhereWhenResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid page, limit or categoryId' })
  list(
    @Query() query: ListWhatWhereWhenQueryDto,
  ): Promise<PaginatedWhatWhereWhenResponseDto> {
    return this.whatWhereWhenService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a What? Where? When? package with its questions (admin only)',
  })
  @ApiOkResponse({ type: WhatWhereWhenResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Package not found' })
  findOne(
    @Param() params: ObjectIdParamDto,
  ): Promise<WhatWhereWhenResponseDto> {
    return this.whatWhereWhenService.findOne(params.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a What? Where? When? package (admin only)' })
  @ApiCreatedResponse({ type: WhatWhereWhenResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, unknown category, empty question, or question images that were not uploaded via POST /images',
  })
  create(
    @Body() dto: CreateWhatWhereWhenDto,
  ): Promise<WhatWhereWhenResponseDto> {
    return this.whatWhereWhenService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a What? Where? When? package; sending questions replaces the whole list (admin only)',
  })
  @ApiOkResponse({ type: WhatWhereWhenResponseDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, unknown category, empty question, or question images that were not uploaded via POST /images',
  })
  @ApiNotFoundResponse({ description: 'Package not found' })
  update(
    @Param() params: ObjectIdParamDto,
    @Body() dto: UpdateWhatWhereWhenDto,
  ): Promise<WhatWhereWhenResponseDto> {
    return this.whatWhereWhenService.update(params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete a What? Where? When? package; its images are kept (admin only)',
  })
  @ApiNoContentResponse({ description: 'Package deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Package not found' })
  remove(@Param() params: ObjectIdParamDto): Promise<void> {
    return this.whatWhereWhenService.remove(params.id);
  }
}
