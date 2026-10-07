import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WhatWhereWhenCategory } from './schemas/what-where-when-category.schema.js';
import { WhatWhereWhenPackage } from './schemas/what-where-when-package.schema.js';
import { WhatWhereWhenCategoriesService } from './what-where-when-categories.service.js';

describe('WhatWhereWhenCategoriesService', () => {
  let service: WhatWhereWhenCategoriesService;
  const duplicateKeyError = Object.assign(new Error('E11000'), {
    code: 11000,
    keyPattern: { name: 1 },
  });

  const makeCategory = (overrides: Record<string, unknown> = {}) => {
    const document = {
      _id: new Types.ObjectId(),
      name: 'Autumn cup',
      description: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      set: vi.fn((changes: Record<string, unknown>) =>
        Object.assign(document, changes),
      ),
      save: vi.fn(),
      deleteOne: vi.fn(),
      ...overrides,
    };
    return document;
  };

  let stored: ReturnType<typeof makeCategory> | null = makeCategory();
  const categoryModel = {
    find: vi.fn(),
    findById: vi.fn(() => ({ exec: vi.fn(async () => stored) })),
    create: vi.fn(),
    exists: vi.fn(),
  };
  const packageModel = {
    aggregate: vi.fn().mockResolvedValue([]),
    countDocuments: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    stored = makeCategory();
    packageModel.aggregate.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        WhatWhereWhenCategoriesService,
        {
          provide: getModelToken(WhatWhereWhenCategory.name),
          useValue: categoryModel,
        },
        {
          provide: getModelToken(WhatWhereWhenPackage.name),
          useValue: packageModel,
        },
      ],
    }).compile();
    service = moduleRef.get(WhatWhereWhenCategoriesService);
  });

  it('creates a category with an empty description by default', async () => {
    categoryModel.create.mockImplementation(async (input) =>
      makeCategory(input),
    );
    const result = await service.create({ name: 'Autumn cup' });
    expect(categoryModel.create).toHaveBeenCalledWith({
      name: 'Autumn cup',
      description: '',
    });
    expect(result).toMatchObject({ name: 'Autumn cup', packageCount: 0 });
  });

  it('maps a duplicate name to 409 on create and update', async () => {
    categoryModel.create.mockRejectedValue(duplicateKeyError);
    await expect(service.create({ name: 'Autumn cup' })).rejects.toThrow(
      ConflictException,
    );

    stored!.save.mockRejectedValue(duplicateKeyError);
    await expect(
      service.update(stored!._id.toString(), { name: 'Taken' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rethrows other database errors', async () => {
    categoryModel.create.mockRejectedValue(new Error('boom'));
    await expect(service.create({ name: 'x' })).rejects.toThrow('boom');
  });

  it('lists categories with their package counts', async () => {
    const used = makeCategory({ name: 'A' });
    const unused = makeCategory({ name: 'B' });
    const query = {
      collation: () => query,
      sort: () => query,
      exec: vi.fn().mockResolvedValue([used, unused]),
    };
    categoryModel.find.mockReturnValue(query);
    packageModel.aggregate.mockResolvedValue([{ _id: used._id, count: 3 }]);

    const result = await service.list();

    expect(result.map((item) => item.packageCount)).toEqual([3, 0]);
  });

  it('refuses to delete a category that packages use', async () => {
    packageModel.countDocuments.mockResolvedValue(2);
    await expect(service.remove(stored!._id.toString())).rejects.toThrow(
      new ConflictException(
        'Category is used by 2 package(s); move or delete them first',
      ),
    );
    expect(stored!.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes an unused category', async () => {
    packageModel.countDocuments.mockResolvedValue(0);
    await service.remove(stored!._id.toString());
    expect(stored!.deleteOne).toHaveBeenCalled();
  });

  it('returns 404 for an unknown category', async () => {
    stored = null;
    const id = new Types.ObjectId().toString();
    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    await expect(service.update(id, { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(id)).rejects.toThrow(NotFoundException);
  });
});
