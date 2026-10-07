import { ApiProperty } from '@nestjs/swagger';
import { WhatWhereWhenCategorySummaryDto } from './what-where-when-category-summary.dto.js';

export class WhatWhereWhenCategoryResponseDto extends WhatWhereWhenCategorySummaryDto {
  @ApiProperty({
    example: 'All rounds of the 2026 autumn cup.',
    description: 'Empty string when there is no description.',
  })
  description: string;

  @ApiProperty({ example: 4, description: 'Packages in this category.' })
  packageCount: number;

  @ApiProperty({ example: '2026-10-07T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-07T12:00:00.000Z' })
  updatedAt: Date;
}
