import { ApiProperty } from '@nestjs/swagger';

export class WhatWhereWhenCategorySummaryDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80930' })
  id: string;

  @ApiProperty({ example: 'Autumn cup 2026' })
  name: string;
}
