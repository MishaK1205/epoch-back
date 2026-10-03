import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { hashPassword, verifyPassword } from '../common/security/password.js';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const conflicts = await this.usersService.findConflicts(
      dto.username,
      dto.email,
    );
    this.throwIfConflicts(conflicts);

    const passwordHash = await hashPassword(dto.password);

    let user: UserDocument;
    try {
      user = await this.usersService.create({
        username: dto.username,
        email: dto.email,
        passwordHash,
      });
    } catch (error) {
      // A concurrent registration can pass the pre-check and still hit the unique index.
      if (isDuplicateKeyError(error)) {
        this.throwIfConflicts({
          username: 'username' in error.keyPattern,
          email: 'email' in error.keyPattern,
        });
      }
      throw error;
    }

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByIdentifierWithPassword(
      dto.identifier,
    );
    const passwordMatches =
      user !== null && (await verifyPassword(dto.password, user.password));

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.usersService.toResponse(user);
  }

  private async buildAuthResponse(
    user: UserDocument,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<number>('JWT_EXPIRES_IN'),
      user: this.usersService.toResponse(user),
    };
  }

  private throwIfConflicts(conflicts: { username: boolean; email: boolean }) {
    if (conflicts.username && conflicts.email) {
      throw new ConflictException('Username and email are already taken');
    }
    if (conflicts.username) {
      throw new ConflictException('Username is already taken');
    }
    if (conflicts.email) {
      throw new ConflictException('Email is already registered');
    }
  }
}
