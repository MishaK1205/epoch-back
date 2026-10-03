import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class UpdateImageDto {
  @ApiProperty({
    example: 'Battle of Didgori painting',
    maxLength: 200,
    description: 'Alternative text. Send an empty string to clear it.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200)
  alt: string;
}
