import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CategoriesService } from './categories.service.js';
import { Category } from './schemas/category.schema.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const categoryModel = {
    exists: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
  };
  const usageChecker = {
    countArticles: vi.fn(),
    countPublishedArticles: vi.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getModelToken(Category.name), useValue: categoryModel },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
    service.registerUsageChecker(usageChecker);
  });

  it('creates a category with a generated slug', async () => {
    categoryModel.exists.mockResolvedValue(null);
    categoryModel.create.mockImplementation(async (data) => ({
      _id: new Types.ObjectId(),
      ...data,
    }));

    const result = await service.create({ name: 'Middle Ages' });

    expect(categoryModel.create).toHaveBeenCalledWith({
      name: 'Middle Ages',
      slug: 'middle-ages',
    });
    expect(result).toMatchObject({ slug: 'middle-ages', articleCount: 0 });
  });

  it('rejects a duplicate name', async () => {
    categoryModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(service.create({ name: 'History' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to delete a category that has articles', async () => {
    usageChecker.countArticles.mockResolvedValue(3);
    await expect(
      service.remove(new Types.ObjectId().toString()),
    ).rejects.toThrow(ConflictException);
    expect(categoryModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('throws when deleting a missing category', async () => {
    usageChecker.countArticles.mockResolvedValue(0);
    categoryModel.findByIdAndDelete.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.remove(new Types.ObjectId().toString()),
    ).rejects.toThrow(NotFoundException);
  });
});
