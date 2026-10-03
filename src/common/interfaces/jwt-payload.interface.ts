import type { Role } from '../enums/role.enum.js';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  /** Not part of the token: set from the database by RolesGuard on `@Roles` routes. */
  role?: Role;
}
