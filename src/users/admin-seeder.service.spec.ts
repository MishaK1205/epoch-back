import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { Role } from '../common/enums/role.enum.js';
import { AdminSeederService } from './admin-seeder.service.js';
import { UsersService } from './users.service.js';

describe('AdminSeederService', () => {
  let seeder: AdminSeederService;
  const usersService = { findByUsernameOrEmail: vi.fn(), create: vi.fn() };
  const env: Record<string, string> = {
    ADMIN_USERNAME: 'Master_Elodin',
    ADMIN_EMAIL: 'Admin@Example.com',
    ADMIN_PASSWORD: 'Adm1nPassword!',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminSeederService,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: (key: string) => env[key] },
        },
      ],
    }).compile();
    seeder = moduleRef.get(AdminSeederService);
  });

  it('creates the admin with a hashed password when missing', async () => {
    usersService.findByUsernameOrEmail.mockResolvedValue(null);

    await seeder.onApplicationBootstrap();

    expect(usersService.findByUsernameOrEmail).toHaveBeenCalledWith(
      'master_elodin',
      'admin@example.com',
    );
    const input = usersService.create.mock.calls[0][0];
    expect(input).toMatchObject({
      username: 'master_elodin',
      email: 'admin@example.com',
      role: Role.Admin,
    });
    expect(await bcrypt.compare(env.ADMIN_PASSWORD, input.passwordHash)).toBe(
      true,
    );
  });

  it('promotes an existing non-admin account without touching its password', async () => {
    const existing = {
      username: 'master_elodin',
      role: Role.User,
      save: vi.fn(),
    };
    usersService.findByUsernameOrEmail.mockResolvedValue(existing);

    await seeder.onApplicationBootstrap();

    expect(existing.role).toBe(Role.Admin);
    expect(existing.save).toHaveBeenCalled();
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('does nothing when the admin already exists', async () => {
    const existing = { role: Role.Admin, save: vi.fn() };
    usersService.findByUsernameOrEmail.mockResolvedValue(existing);

    await seeder.onApplicationBootstrap();

    expect(existing.save).not.toHaveBeenCalled();
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
