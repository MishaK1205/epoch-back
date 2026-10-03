import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  const usersService = {
    findConflicts: vi.fn(),
    create: vi.fn(),
    findByIdentifierWithPassword: vi.fn(),
    findById: vi.fn(),
    toResponse: vi.fn((user: { _id: Types.ObjectId; username: string }) => ({
      id: user._id.toString(),
      username: user.username,
    })),
  };
  const jwtService = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  const configService = { getOrThrow: vi.fn().mockReturnValue(3600) };

  const makeUser = (password = 'hashed') => ({
    _id: new Types.ObjectId(),
    username: 'john_doe',
    email: 'john@example.com',
    password,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'Str0ngPassw0rd',
    };

    it('hashes the password, creates the user and returns a token', async () => {
      usersService.findConflicts.mockResolvedValue({
        username: false,
        email: false,
      });
      usersService.create.mockImplementation(async (input) =>
        makeUser(input.passwordHash),
      );

      const result = await authService.register(dto);

      const { passwordHash } = usersService.create.mock.calls[0][0];
      expect(passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, passwordHash)).toBe(true);
      expect(result).toMatchObject({
        accessToken: 'signed-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { username: 'john_doe' },
      });
    });

    it('rejects a taken username', async () => {
      usersService.findConflicts.mockResolvedValue({
        username: true,
        email: false,
      });
      await expect(authService.register(dto)).rejects.toThrow(
        new ConflictException('Username is already taken'),
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('rejects a taken email', async () => {
      usersService.findConflicts.mockResolvedValue({
        username: false,
        email: true,
      });
      await expect(authService.register(dto)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );
    });

    it('maps a duplicate-key race to a conflict', async () => {
      usersService.findConflicts.mockResolvedValue({
        username: false,
        email: false,
      });
      usersService.create.mockRejectedValue({
        code: 11000,
        keyPattern: { email: 1 },
      });
      await expect(authService.register(dto)).rejects.toThrow(
        new ConflictException('Email is already registered'),
      );
    });
  });

  describe('login', () => {
    it('returns a token for a correct password', async () => {
      const hash = await bcrypt.hash('Str0ngPassw0rd', 4);
      usersService.findByIdentifierWithPassword.mockResolvedValue(
        makeUser(hash),
      );

      const result = await authService.login({
        identifier: 'john@example.com',
        password: 'Str0ngPassw0rd',
      });

      expect(usersService.findByIdentifierWithPassword).toHaveBeenCalledWith(
        'john@example.com',
      );
      expect(result.accessToken).toBe('signed-token');
    });

    it('rejects a wrong password', async () => {
      const hash = await bcrypt.hash('Str0ngPassw0rd', 4);
      usersService.findByIdentifierWithPassword.mockResolvedValue(
        makeUser(hash),
      );

      await expect(
        authService.login({ identifier: 'john_doe', password: 'wrong-pass1' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('rejects an unknown user with the same message', async () => {
      usersService.findByIdentifierWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({ identifier: 'nobody', password: 'whatever1' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });
  });
});
