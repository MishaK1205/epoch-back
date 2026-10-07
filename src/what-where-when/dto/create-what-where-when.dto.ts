import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { WhatWhereWhenQuestionDto } from './what-where-when-question.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeAuthors = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.map((author: unknown) =>
            typeof author === 'string' ? author.trim() : author,
          ),
        ),
      ].filter((author) => author !== '')
    : value;

export class CreateWhatWhereWhenDto {
  @ApiProperty({ example: 'Autumn cup, round 1', minLength: 1, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Giorgi Beridze', 'Nino Kapanadze'],
    maxItems: 20,
    description:
      'Up to 20 authors, each 1-100 characters. Trimmed; empty and duplicate names are removed.',
  })
  @IsOptional()
  @Transform(normalizeAuthors)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  authors?: string[];

  @ApiPropertyOptional({
    example: '66f1c0d2a3b4c5d6e7f80930',
    nullable: true,
    description:
      'Id of a What? Where? When? category (GET /what-where-when-categories). Omitted or null on create means none; on update, omitted keeps it and null removes it.',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;

  @ApiProperty({
    example: '2026-10-07',
    description: 'Calendar date as YYYY-MM-DD.',
  })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date must be a valid date' })
  date: string;

  @ApiPropertyOptional({
    type: [WhatWhereWhenQuestionDto],
    maxItems: 100,
    description:
      'Questions in the order they are asked. On update, the whole list is replaced.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WhatWhereWhenQuestionDto)
  questions?: WhatWhereWhenQuestionDto[];
}
