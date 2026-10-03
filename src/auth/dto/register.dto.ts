import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

const trimAndLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({
    example: 'john_doe',
    minLength: 3,
    maxLength: 30,
    description:
      'Letters, numbers, underscores and dots. Stored in lowercase and must be unique.',
  })
  @Transform(trimAndLowercase)
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_.]+$/, {
    message: 'username may only contain letters, numbers, underscores and dots',
  })
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    maxLength: 254,
    description: 'Stored in lowercase and must be unique.',
  })
  @Transform(trimAndLowercase)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Str0ngPassw0rd',
    minLength: 8,
    maxLength: 72,
    description: 'Must contain at least one letter and one number.',
  })
  @IsString()
  @Length(8, 72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;
}
