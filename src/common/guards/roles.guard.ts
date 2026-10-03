import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../enums/role.enum.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    if (!request.user) {
      throw new UnauthorizedException('Missing access token');
    }

    // Read the role from the database so role changes apply without re-login.
    const user = await this.usersService.findById(request.user.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    request.user.role = user.role;
    return true;
  }
}
