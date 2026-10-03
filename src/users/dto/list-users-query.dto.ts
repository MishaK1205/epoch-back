import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { Role } from '../../common/enums/role.enum.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role, description: 'Filter by role.' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
