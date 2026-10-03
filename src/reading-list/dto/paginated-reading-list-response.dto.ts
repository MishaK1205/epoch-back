import { ApiProperty } from '@nestjs/swagger';
import { ReadingListItemDto } from './reading-list-item.dto.js';

export class PaginatedReadingListResponseDto {
  @ApiProperty({ type: [ReadingListItemDto] })
  items: ReadingListItemDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
