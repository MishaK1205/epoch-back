import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class WhatWhereWhenQuestionDto {
  @ApiProperty({
    example: '<p>What is shown in the picture?</p><p><img src="..."></p>',
    maxLength: 100_000,
    description:
      'HTML from the Quill editor. It is sanitized on save. Images must be uploaded via POST /images first and referenced by their returned url.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  question: string;

  @ApiProperty({
    example: 'The Narikala fortress',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  answer: string;

  @ApiPropertyOptional({
    example: 'Built in the 4th century.',
    maxLength: 5000,
    description: 'Plain text. Omitted means an empty comment.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
