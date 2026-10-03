import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enums/role.enum.js';
import { hashPassword } from '../common/security/password.js';
import { UsersService } from './users.service.js';

@Injectable()
export class AdminSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const username = this.configService
      .getOrThrow<string>('ADMIN_USERNAME')
      .trim()
      .toLowerCase();
    const email = this.configService
      .getOrThrow<string>('ADMIN_EMAIL')
      .trim()
      .toLowerCase();

    const existing = await this.usersService.findByUsernameOrEmail(
      username,
      email,
    );
    if (existing) {
      // Never overwrite the password here so the admin can change it later.
      if (existing.role !== Role.Admin) {
        existing.role = Role.Admin;
        await existing.save();
        this.logger.log(
          `Promoted existing user "${existing.username}" to admin`,
        );
      }
      return;
    }

    await this.usersService.create({
      username,
      email,
      passwordHash: await hashPassword(
        this.configService.getOrThrow<string>('ADMIN_PASSWORD'),
      ),
      role: Role.Admin,
    });
    this.logger.log(`Created admin user "${username}"`);
  }
}
