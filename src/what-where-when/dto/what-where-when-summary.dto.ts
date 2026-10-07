import { ApiProperty } from '@nestjs/swagger';
import { WhatWhereWhenCategorySummaryDto } from './what-where-when-category-summary.dto.js';

export class WhatWhereWhenSummaryDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80920' })
  id: string;

  @ApiProperty({ example: 'Autumn cup, round 1' })
  name: string;

  @ApiProperty({ type: [String], example: ['Giorgi Beridze'] })
  authors: string[];

  @ApiProperty({
    type: WhatWhereWhenCategorySummaryDto,
    nullable: true,
    description: 'null when the package has no category.',
  })
  category: WhatWhereWhenCategorySummaryDto | null;

  @ApiProperty({ example: '2026-10-07', description: 'YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 12 })
  questionCount: number;

  @ApiProperty({ example: '2026-10-07T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-07T12:00:00.000Z' })
  updatedAt: Date;
}
