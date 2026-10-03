import { ApiProperty } from '@nestjs/swagger';
import { ArticleSummaryDto } from './article-summary.dto.js';

export class PaginatedArticlesResponseDto {
  @ApiProperty({ type: [ArticleSummaryDto] })
  items: ArticleSummaryDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
