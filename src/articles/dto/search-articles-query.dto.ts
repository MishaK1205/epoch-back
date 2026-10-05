import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class SearchArticlesQueryDto extends PaginationQueryDto {
  @ApiProperty({
    example: 'სებას',
    maxLength: 100,
    description:
      'Partial, case-insensitive match on title and tags. Every word must appear in the title or in one of the tags.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.normalize('NFC').trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;
}
