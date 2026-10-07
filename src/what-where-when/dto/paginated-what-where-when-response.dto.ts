import { ApiProperty } from '@nestjs/swagger';
import { WhatWhereWhenSummaryDto } from './what-where-when-summary.dto.js';

export class PaginatedWhatWhereWhenResponseDto {
  @ApiProperty({ type: [WhatWhereWhenSummaryDto] })
  items: WhatWhereWhenSummaryDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
