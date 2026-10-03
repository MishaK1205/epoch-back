import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ObjectIdParamDto } from '../common/dto/object-id-param.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Requires the admin role' })
@Roles(Role.Admin)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin only)' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    return this.usersService.list(query);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: "Change a user's role (admin only)" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid user id or role' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateRole(
    @CurrentUser() actor: JwtPayload,
    @Param() params: ObjectIdParamDto,
    @Body() dto: UpdateRoleDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateRole(actor.sub, params.id, dto.role);
  }
}
