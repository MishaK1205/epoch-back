import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ArticleContentService } from '../articles/article-content.service.js';
import { ImagesService } from '../images/images.service.js';
import { WhatWhereWhenPackage } from './schemas/what-where-when-package.schema.js';
import { WhatWhereWhenCategoriesService } from './what-where-when-categories.service.js';
import { WhatWhereWhenService } from './what-where-when.service.js';

describe('WhatWhereWhenService', () => {
  let service: WhatWhereWhenService;
  const imageId = new Types.ObjectId().toString();
  const categoryId = new Types.ObjectId().toString();
  const categorySummary = { id: categoryId, name: 'Autumn cup' };
  const filename = '0b8f6c1e-4a52-4f0e-9a43-2a1f2b3c4d5e.png';

  const makePackage = (overrides: Record<string, unknown> = {}) => {
    const document = {
      _id: new Types.ObjectId(),
      name: 'Autumn cup',
      authors: ['Giorgi'],
      category: new Types.ObjectId(categoryId) as Types.ObjectId | null,
      date: '2026-10-07',
      questions: [{ question: '<p>old</p>', answer: 'old', comment: '' }],
      images: [] as Types.ObjectId[],
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

  let stored: ReturnType<typeof makePackage> | null = makePackage();
  const packageModel = {
    findById: vi.fn(() => ({ exec: vi.fn(async () => stored) })),
    create: vi.fn(async (input: Record<string, unknown>) => makePackage(input)),
    exists: vi.fn(),
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
  };
  const categoriesService = {
    exists: vi.fn(),
    findSummariesByIds: vi.fn(),
  };
  const imagesService = {
    registerUsageChecker: vi.fn(),
    findIdsByFilenames: vi.fn(),
  };
  const contentService = {
    process: vi.fn((html: string) => ({
      html: `clean:${html}`,
      plainText: 'x',
      excerpt: 'x',
      imageFilenames: html.includes('img') ? [filename] : [],
    })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    stored = makePackage();
    imagesService.findIdsByFilenames.mockResolvedValue(
      new Map([[filename, imageId]]),
    );
    categoriesService.exists.mockImplementation(
      async (id: string) => id === categoryId,
    );
    categoriesService.findSummariesByIds.mockImplementation(
      async (ids: string[]) =>
        new Map(
          ids.includes(categoryId) ? [[categoryId, categorySummary]] : [],
        ),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        WhatWhereWhenService,
        {
          provide: getModelToken(WhatWhereWhenPackage.name),
          useValue: packageModel,
        },
        { provide: ImagesService, useValue: imagesService },
        { provide: ArticleContentService, useValue: contentService },
        {
          provide: WhatWhereWhenCategoriesService,
          useValue: categoriesService,
        },
      ],
    }).compile();
    service = moduleRef.get(WhatWhereWhenService);
  });

  const createDto = {
    name: 'Autumn cup',
    authors: ['Giorgi'],
    date: '2026-10-07',
    questions: [
      { question: '<p>Q1 <img src="x"></p>', answer: 'A1', comment: 'C1' },
      { question: '<p>Q2</p>', answer: 'A2' },
    ],
  };

  it('registers itself as an image usage checker', () => {
    service.onModuleInit();
    expect(imagesService.registerUsageChecker).toHaveBeenCalledWith(
      service,
      expect.stringContaining('What? Where? When?'),
    );
  });

  it('sanitizes questions, keeps their order and records their images', async () => {
    const result = await service.create(createDto);

    expect(contentService.process).toHaveBeenCalledWith(
      '<p>Q2</p>',
      'Question 2 cannot be empty',
    );
    const saved = packageModel.create.mock.calls[0][0];
    expect(saved.questions).toEqual([
      {
        question: 'clean:<p>Q1 <img src="x"></p>',
        answer: 'A1',
        comment: 'C1',
      },
      { question: 'clean:<p>Q2</p>', answer: 'A2', comment: '' },
    ]);
    expect(saved.images.map(String)).toEqual([imageId]);
    expect(result).toMatchObject({
      name: 'Autumn cup',
      questionCount: 2,
      questions: [{ answer: 'A1' }, { answer: 'A2', comment: '' }],
    });
  });

  it('creates a package without questions or authors', async () => {
    const result = await service.create({ name: 'Empty', date: '2026-10-07' });
    expect(packageModel.create.mock.calls[0][0]).toMatchObject({
      authors: [],
      questions: [],
      images: [],
    });
    expect(result.questionCount).toBe(0);
  });

  it('assigns an existing category and returns its summary', async () => {
    const result = await service.create({ ...createDto, categoryId });
    expect(String(packageModel.create.mock.calls[0][0].category)).toBe(
      categoryId,
    );
    expect(result.category).toEqual(categorySummary);
  });

  it('stores no category when none is sent', async () => {
    const result = await service.create(createDto);
    expect(packageModel.create.mock.calls[0][0].category).toBeNull();
    expect(result.category).toBeNull();
  });

  it('rejects an unknown category', async () => {
    await expect(
      service.create({
        ...createDto,
        categoryId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow(new BadRequestException('Category does not exist'));
    expect(packageModel.create).not.toHaveBeenCalled();
  });

  it('keeps the category when categoryId is omitted and removes it on null', async () => {
    let result = await service.update(stored!._id.toString(), { name: 'x' });
    expect(result.category).toEqual(categorySummary);

    result = await service.update(stored!._id.toString(), {
      categoryId: null,
    });
    expect(stored!.category).toBeNull();
    expect(result.category).toBeNull();
  });

  it('filters the list by category and resolves category summaries', async () => {
    packageModel.aggregate.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        name: 'P',
        authors: [],
        category: new Types.ObjectId(categoryId),
        date: '2026-10-07',
        questionCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    packageModel.countDocuments.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20, categoryId });

    const pipeline = packageModel.aggregate.mock.calls[0][0];
    expect(String(pipeline[0].$match.category)).toBe(categoryId);
    expect(String(packageModel.countDocuments.mock.calls[0][0].category)).toBe(
      categoryId,
    );
    expect(result.items[0]).toMatchObject({
      questionCount: 3,
      category: categorySummary,
    });
  });

  it('rejects questions that reference unknown images', async () => {
    imagesService.findIdsByFilenames.mockResolvedValue(new Map());
    await expect(service.create(createDto)).rejects.toThrow(
      new BadRequestException(
        `Questions reference images that do not exist: ${filename}`,
      ),
    );
    expect(packageModel.create).not.toHaveBeenCalled();
  });

  it('updates fields without touching questions when none are sent', async () => {
    const result = await service.update(stored!._id.toString(), {
      name: 'Renamed',
    });
    expect(contentService.process).not.toHaveBeenCalled();
    expect(stored!.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      name: 'Renamed',
      questions: [{ answer: 'old' }],
    });
  });

  it('replaces the whole question list when questions are sent', async () => {
    const result = await service.update(stored!._id.toString(), {
      questions: [{ question: '<p>new</p>', answer: 'new' }],
    });
    expect(result.questions).toEqual([
      { question: 'clean:<p>new</p>', answer: 'new', comment: '' },
    ]);
    expect(stored!.images).toEqual([]);
  });

  it('returns 404 for an unknown package', async () => {
    stored = null;
    const id = new Types.ObjectId().toString();
    await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    await expect(service.update(id, { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove(id)).rejects.toThrow(NotFoundException);
  });

  it('deletes an existing package', async () => {
    await service.remove(stored!._id.toString());
    expect(stored!.deleteOne).toHaveBeenCalled();
  });

  it('reports images used by any package', async () => {
    packageModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    expect(await service.isImageInUse(imageId)).toBe(true);
    packageModel.exists.mockResolvedValue(null);
    expect(await service.isImageInUse(imageId)).toBe(false);
  });
});
