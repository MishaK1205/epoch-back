import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ListWhatWhereWhenQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '66f1c0d2a3b4c5d6e7f80930',
    description: 'Only packages in this category.',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
