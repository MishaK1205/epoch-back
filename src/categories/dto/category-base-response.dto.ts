import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategorySummaryDto } from './category-summary.dto.js';

export class CategoryBaseResponseDto extends CategorySummaryDto {
  @ApiPropertyOptional({
    example: 'Articles about historical events and people.',
  })
  description?: string;

  @ApiProperty({
    type: CategorySummaryDto,
    nullable: true,
    description: 'The parent category for subcategories; null for top-level.',
  })
  parent: CategorySummaryDto | null;

  @ApiProperty({
    example: 12,
    description:
      'Number of published articles. For a top-level category this includes the articles in its subcategories.',
  })
  articleCount: number;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  updatedAt: Date;
}
