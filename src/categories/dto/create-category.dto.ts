import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @ApiProperty({ example: 'History', minLength: 2, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiPropertyOptional({
    example: 'Articles about historical events and people.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}
