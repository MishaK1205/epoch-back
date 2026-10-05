import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'history',
    description:
      'Category or subcategory slug. A top-level category also matches articles in its subcategories.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    example: '665f1c2e8b3f4a0012345678',
    description:
      'Category or subcategory id. Combined with `category`, both must match.',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'middle ages' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(30)
  tag?: string;

  @ApiPropertyOptional({
    example: 'master_elodin',
    description: 'Author username.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  author?: string;

  @ApiPropertyOptional({
    example: 'didgori',
    description: 'Full-text search over title and content.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
}
