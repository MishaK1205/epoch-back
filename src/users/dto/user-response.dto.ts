import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum.js';

export class UserResponseDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80912' })
  id: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.User })
  role: Role;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  updatedAt: Date;
}
