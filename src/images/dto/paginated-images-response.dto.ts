import { ApiProperty } from '@nestjs/swagger';
import { ImageResponseDto } from './image-response.dto.js';

export class PaginatedImagesResponseDto {
  @ApiProperty({ type: [ImageResponseDto] })
  items: ImageResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
