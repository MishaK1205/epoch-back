import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { User, UserDocument } from './schemas/user.schema.js';

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create({
      username: input.username,
      email: input.email,
      password: input.passwordHash,
      role: input.role ?? Role.User,
    });
  }

  async findConflicts(
    username: string,
    email: string,
  ): Promise<{ username: boolean; email: boolean }> {
    const existing = await this.userModel
      .find({ $or: [{ username }, { email }] })
      .select('username email')
      .lean();

    return {
      username: existing.some((user) => user.username === username),
      email: existing.some((user) => user.email === email),
    };
  }

  async findByUsernameOrEmail(
    username: string,
    email: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({ $or: [{ username }, { email }] }).exec();
  }

  async findByIdentifierWithPassword(
    identifier: string,
  ): Promise<UserDocument | null> {
    const filter = identifier.includes('@')
      ? { email: identifier }
      : { username: identifier };

    return this.userModel.findOne(filter).select('+password').exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }

  async findUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
    const users = await this.userModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .select('username')
      .lean();
    return new Map(users.map((user) => [user._id.toString(), user.username]));
  }

  async findIdByUsername(username: string): Promise<string | null> {
    const user = await this.userModel
      .findOne({ username: username.trim().toLowerCase() })
      .select('_id')
      .lean();
    return user ? user._id.toString() : null;
  }

  async list(query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const filter = query.role ? { role: query.role } : {};
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      items: users.map((user) => this.toResponse(user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updateRole(
    actorId: string,
    targetId: string,
    role: Role,
  ): Promise<UserResponseDto> {
    // Prevents an admin from accidentally locking themselves out.
    if (actorId === targetId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        targetId,
        { role },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  toResponse(user: UserDocument): UserResponseDto {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
