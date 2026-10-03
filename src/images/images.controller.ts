import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Role } from '../common/enums/role.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ImageResponseDto } from './dto/image-response.dto.js';
import { PaginatedImagesResponseDto } from './dto/paginated-images-response.dto.js';
import { UpdateImageDto } from './dto/update-image.dto.js';
import { UploadImageDto } from './dto/upload-image.dto.js';
import {
  ALLOWED_IMAGE_TYPES,
  ImagesService,
  type UploadedImageFile,
} from './images.service.js';

@ApiTags('images')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Requires the moderator or admin role' })
@Roles(Role.Moderator, Role.Admin)
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an image (jpeg, png, webp or gif)',
    description:
      'Use the returned `url` as an article cover image or inside article content.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string', maxLength: 200 },
      },
    },
  })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiBadRequestResponse({ description: 'Missing file or unsupported type' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds the size limit' })
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: ALLOWED_IMAGE_TYPES,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: UploadedImageFile,
    @Body() dto: UploadImageDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ImageResponseDto> {
    return this.imagesService.upload(file, dto.alt, actor);
  }

  @Get()
  @ApiOperation({
    summary: 'List images (moderators see their own, admins see all)',
  })
  @ApiOkResponse({ type: PaginatedImagesResponseDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<PaginatedImagesResponseDto> {
    return this.imagesService.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get image details' })
  @ApiOkResponse({ type: ImageResponseDto })
  @ApiNotFoundResponse({ description: 'Image not found' })
  findOne(@Param() params: ObjectIdParamDto): Promise<ImageResponseDto> {
    return this.imagesService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update an image's alt text (owner or admin)" })
  @ApiOkResponse({ type: ImageResponseDto })
  @ApiNotFoundResponse({ description: 'Image not found' })
  updateAlt(
    @Param() params: ObjectIdParamDto,
    @Body() dto: UpdateImageDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<ImageResponseDto> {
    return this.imagesService.updateAlt(params.id, dto.alt, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an image (owner or admin)' })
  @ApiNoContentResponse({ description: 'Image deleted' })
  @ApiNotFoundResponse({ description: 'Image not found' })
  @ApiConflictResponse({ description: 'Image is used by an article' })
  remove(
    @Param() params: ObjectIdParamDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    return this.imagesService.remove(params.id, actor);
  }
}
