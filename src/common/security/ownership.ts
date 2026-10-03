import { ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/**
 * `actor.role` is only populated by RolesGuard, so call this from routes
 * decorated with `@Roles(...)`. Without a role it fails closed for non-owners.
 */
export function assertOwnerOrAdmin(
  actor: JwtPayload,
  ownerId: string,
  message = 'You can only modify your own content',
): void {
  if (actor.role === Role.Admin || actor.sub === ownerId) {
    return;
  }
  throw new ForbiddenException(message);
}

export function isAdmin(actor: JwtPayload): boolean {
  return actor.role === Role.Admin;
}
