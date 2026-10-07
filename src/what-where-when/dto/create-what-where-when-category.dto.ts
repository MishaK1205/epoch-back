import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateWhatWhereWhenCategoryDto {
  @ApiProperty({ example: 'Autumn cup 2026', minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    example: 'All rounds of the 2026 autumn cup.',
    maxLength: 500,
    description: 'Omitted means an empty description; send "" to clear it.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}
