import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../common/enums/role.enum.js';
import { User } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

describe('UsersService.updateRole', () => {
  let usersService: UsersService;
  const exec = vi.fn();
  const userModel = { findByIdAndUpdate: vi.fn(() => ({ exec })) };
  const actorId = new Types.ObjectId().toString();
  const targetId = new Types.ObjectId().toString();

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();
    usersService = moduleRef.get(UsersService);
  });

  it('updates and returns the target user', async () => {
    exec.mockResolvedValue({
      _id: new Types.ObjectId(targetId),
      username: 'john_doe',
      email: 'john@example.com',
      role: Role.Moderator,
    });

    const result = await usersService.updateRole(
      actorId,
      targetId,
      Role.Moderator,
    );

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      targetId,
      { role: Role.Moderator },
      expect.anything(),
    );
    expect(result).toMatchObject({ id: targetId, role: Role.Moderator });
  });

  it('refuses to change your own role', async () => {
    await expect(
      usersService.updateRole(actorId, actorId, Role.User),
    ).rejects.toThrow(ForbiddenException);
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('throws when the user does not exist', async () => {
    exec.mockResolvedValue(null);
    await expect(
      usersService.updateRole(actorId, targetId, Role.Admin),
    ).rejects.toThrow(NotFoundException);
  });
});
