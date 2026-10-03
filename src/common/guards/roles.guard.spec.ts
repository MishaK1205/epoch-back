import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/users.service.js';
import { Role } from '../enums/role.enum.js';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const usersService = { findById: vi.fn() };
  const guard = new RolesGuard(
    reflector as unknown as Reflector,
    usersService as unknown as UsersService,
  );
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'user-id' } }) }),
  } as unknown as ExecutionContext;

  beforeEach(() => vi.clearAllMocks());

  it('allows routes without @Roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('allows a user whose stored role matches', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin]);
    usersService.findById.mockResolvedValue({ role: Role.Admin });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a user whose stored role does not match', async () => {
    reflector.getAllAndOverride.mockReturnValue([Role.Admin]);
    usersService.findById.mockResolvedValue({ role: Role.Moderator });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
