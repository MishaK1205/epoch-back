import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImageDto {
  @ApiPropertyOptional({
    example: 'Battle of Didgori painting',
    maxLength: 200,
    description: 'Alternative text for accessibility.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200)
  alt?: string;
}
