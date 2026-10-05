import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const normalizeTags = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.map((tag: unknown) =>
            typeof tag === 'string' ? tag.trim().toLowerCase() : tag,
          ),
        ),
      ].filter((tag) => tag !== '')
    : value;

export class CreateArticleDto {
  @ApiProperty({
    example: 'The Battle of Didgori',
    minLength: 3,
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiProperty({
    example: '<p>In 1121, King David IV...</p>',
    description:
      'HTML from the Quill editor. It is sanitized on save. Images must be uploaded via POST /images first and referenced by their returned url.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000_000)
  content: string;

  @ApiProperty({
    example: '66f1c0d2a3b4c5d6e7f80912',
    description: 'Id of an uploaded image (POST /images).',
  })
  @IsMongoId()
  coverImageId: string;

  @ApiProperty({
    example: '66f1c0d2a3b4c5d6e7f80913',
    description: 'Id of a top-level category.',
  })
  @IsMongoId()
  categoryId: string;

  @ApiPropertyOptional({
    example: '66f1c0d2a3b4c5d6e7f80915',
    nullable: true,
    description:
      'Optional id of a subcategory of `categoryId`. Send null on update to remove it.',
  })
  @IsOptional()
  @IsMongoId()
  subcategoryId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['middle ages', 'georgia'],
    maxItems: 10,
    description: 'Up to 10 tags, each 1-30 characters. Stored in lowercase.',
  })
  @IsOptional()
  @Transform(normalizeTags)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  tags?: string[];
}
