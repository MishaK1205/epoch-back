import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../common/enums/role.enum.js';
import { ImagesService } from './images.service.js';
import { Image } from './schemas/image.schema.js';

describe('ImagesService', () => {
  let service: ImagesService;
  const ownerId = new Types.ObjectId().toString();
  const filename = '0b8f6c1e-4a52-4f0e-9a43-2a1f2b3c4d5e.png';
  const image = {
    _id: new Types.ObjectId(),
    filename,
    uploadedBy: new Types.ObjectId(ownerId),
    deleteOne: vi.fn(),
  };
  const imageModel = {
    findById: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(image) })),
  };
  const usageChecker = { isImageInUse: vi.fn() };
  const otherUsageChecker = { isImageInUse: vi.fn() };
  const env: Record<string, string> = {
    UPLOAD_DIR: 'uploads-test',
    PUBLIC_BASE_URL: 'http://localhost:3000',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getModelToken(Image.name), useValue: imageModel },
        {
          provide: ConfigService,
          useValue: { getOrThrow: (key: string) => env[key] },
        },
      ],
    }).compile();
    service = moduleRef.get(ImagesService);
    service.registerUsageChecker(usageChecker, 'Image is used by an article');
    service.registerUsageChecker(otherUsageChecker, 'Image is used elsewhere');
    otherUsageChecker.isImageInUse.mockResolvedValue(false);
  });

  const moderator = (sub: string) => ({
    sub,
    username: 'mod',
    email: 'mod@example.com',
    role: Role.Moderator,
  });

  it("forbids moderators from deleting someone else's image", async () => {
    await expect(
      service.remove(
        image._id.toString(),
        moderator(new Types.ObjectId().toString()),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(image.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses to delete an image used by an article', async () => {
    usageChecker.isImageInUse.mockResolvedValue(true);
    await expect(
      service.remove(image._id.toString(), moderator(ownerId)),
    ).rejects.toThrow(new ConflictException('Image is used by an article'));
    expect(image.deleteOne).not.toHaveBeenCalled();
  });

  it('checks every registered usage checker before deleting', async () => {
    usageChecker.isImageInUse.mockResolvedValue(false);
    otherUsageChecker.isImageInUse.mockResolvedValue(true);
    await expect(
      service.remove(image._id.toString(), moderator(ownerId)),
    ).rejects.toThrow(new ConflictException('Image is used elsewhere'));
    expect(image.deleteOne).not.toHaveBeenCalled();
  });

  it('lets an admin delete any unused image', async () => {
    usageChecker.isImageInUse.mockResolvedValue(false);
    await service.remove(image._id.toString(), {
      ...moderator(new Types.ObjectId().toString()),
      role: Role.Admin,
    });
    expect(image.deleteOne).toHaveBeenCalled();
  });

  it.each([
    [`http://localhost:3000/uploads/${filename}`, filename],
    [`/uploads/${filename}`, filename],
    [`https://evil.com/uploads/${filename}`, null],
    ['/uploads/../.env', null],
  ])('extractUploadFilename(%s)', (src, expected) => {
    expect(service.extractUploadFilename(src)).toBe(expected);
  });
});
