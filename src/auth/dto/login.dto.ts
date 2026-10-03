import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john_doe',
    description: 'Username or email address.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;

  @ApiProperty({ example: 'Str0ngPassw0rd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
