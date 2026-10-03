import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategorySummaryDto } from './category-summary.dto.js';

export class CategoryResponseDto extends CategorySummaryDto {
  @ApiPropertyOptional({
    example: 'Articles about historical events and people.',
  })
  description?: string;

  @ApiProperty({ example: 12, description: 'Number of published articles.' })
  articleCount: number;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  updatedAt: Date;
}
