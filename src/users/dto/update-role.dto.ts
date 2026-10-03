import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../common/enums/role.enum.js';

export class UpdateRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.Moderator,
    description: 'New role. Use "user" to revoke moderator/admin rights.',
  })
  @IsEnum(Role)
  role: Role;
}
