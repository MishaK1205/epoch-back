import { ApiProperty } from '@nestjs/swagger';

export class WhatWhereWhenQuestionResponseDto {
  @ApiProperty({
    example: '<p>What is shown in the picture?</p>',
    description: 'Sanitized HTML, safe to render directly.',
  })
  question: string;

  @ApiProperty({ example: 'The Narikala fortress' })
  answer: string;

  @ApiProperty({
    example: 'Built in the 4th century.',
    description: 'Plain text; empty string when there is no comment.',
  })
  comment: string;
}
