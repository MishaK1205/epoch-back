import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ArticleStatus } from '../enums/article-status.enum.js';

export class ManageArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ArticleStatus })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @ApiPropertyOptional({
    example: '665f1c2e8b3f4a0012345678',
    description: 'Category id.',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
