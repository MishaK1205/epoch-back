import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
    find: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(0),
    findByIdAndDelete: vi.fn(),
  };
  const usageChecker = {
    countArticles: vi.fn(),
    countPublishedArticles: vi.fn().mockResolvedValue(new Map()),
  };

  const makeCategory = (name: string, parent: Types.ObjectId | null = null) => {
    const _id = new Types.ObjectId();
    return { _id, name, slug: name.toLowerCase(), parent };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    categoryModel.countDocuments.mockResolvedValue(0);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getModelToken(Category.name), useValue: categoryModel },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
    service.registerUsageChecker(usageChecker);
  });

  it('creates a top-level category with a generated slug', async () => {
    categoryModel.exists.mockResolvedValue(null);
    categoryModel.create.mockImplementation(async (data) => ({
      _id: new Types.ObjectId(),
      ...data,
    }));

    const result = await service.create({ name: 'Middle Ages' });

    expect(categoryModel.create).toHaveBeenCalledWith({
      name: 'Middle Ages',
      slug: 'middle-ages',
      parent: null,
    });
    expect(result).toMatchObject({
      slug: 'middle-ages',
      articleCount: 0,
      parent: null,
      subcategories: [],
    });
  });

  it('creates a subcategory under a top-level parent', async () => {
    const parent = makeCategory('History');
    categoryModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(parent),
    });
    categoryModel.exists.mockResolvedValue(null);
    categoryModel.create.mockImplementation(async (data) => ({
      _id: new Types.ObjectId(),
      ...data,
    }));

    const result = await service.create({
      name: 'Medieval',
      parentId: parent._id.toString(),
    });

    expect(categoryModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'medieval', parent: parent._id }),
    );
    expect(result.parent).toEqual({
      id: parent._id.toString(),
      name: 'History',
      slug: 'history',
    });
  });

  it('rejects an unknown parent', async () => {
    categoryModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.create({
        name: 'Medieval',
        parentId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow(
      new BadRequestException('Parent category does not exist'),
    );
  });

  it('rejects nesting a subcategory under another subcategory', async () => {
    categoryModel.findById.mockReturnValue({
      exec: vi
        .fn()
        .mockResolvedValue(makeCategory('Medieval', new Types.ObjectId())),
    });
    await expect(
      service.create({
        name: 'Crusades',
        parentId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(categoryModel.create).not.toHaveBeenCalled();
  });

  it('lists top-level categories with their subcategories nested', async () => {
    const history = makeCategory('History');
    const art = makeCategory('Art');
    const medieval = makeCategory('Medieval', history._id);
    categoryModel.find.mockReturnValue({
      sort: () => ({
        exec: vi.fn().mockResolvedValue([art, history, medieval]),
      }),
    });
    usageChecker.countPublishedArticles.mockResolvedValueOnce(
      new Map([
        [history._id.toString(), 5],
        [medieval._id.toString(), 2],
      ]),
    );

    const result = await service.list();

    expect(result.map((category) => category.slug)).toEqual(['art', 'history']);
    expect(result[0].subcategories).toEqual([]);
    expect(result[1]).toMatchObject({
      articleCount: 5,
      subcategories: [
        {
          slug: 'medieval',
          articleCount: 2,
          parent: { id: history._id.toString(), slug: 'history' },
        },
      ],
    });
  });

  it('rejects a duplicate name', async () => {
    categoryModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(service.create({ name: 'History' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('refuses to delete a category that has subcategories', async () => {
    categoryModel.countDocuments.mockResolvedValue(2);
    await expect(
      service.remove(new Types.ObjectId().toString()),
    ).rejects.toThrow(
      new ConflictException(
        'Category has 2 subcategory(ies); delete them first',
      ),
    );
    expect(categoryModel.findByIdAndDelete).not.toHaveBeenCalled();
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
