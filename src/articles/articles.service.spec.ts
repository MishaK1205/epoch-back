import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CategoriesService } from '../categories/categories.service.js';
import { Role } from '../common/enums/role.enum.js';
import { ImagesService } from '../images/images.service.js';
import { UsersService } from '../users/users.service.js';
import { ArticleContentService } from './article-content.service.js';
import { ArticlesService } from './articles.service.js';
import { ArticleStatus } from './enums/article-status.enum.js';
import { Article } from './schemas/article.schema.js';

describe('ArticlesService', () => {
  let service: ArticlesService;
  const authorId = new Types.ObjectId().toString();
  const categoryId = new Types.ObjectId().toString();
  const coverId = new Types.ObjectId().toString();

  const makeArticle = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    title: 'Didgori',
    slug: 'didgori',
    content: '<p>x</p>',
    excerpt: 'x',
    coverImage: new Types.ObjectId(coverId),
    category: new Types.ObjectId(categoryId),
    tags: [],
    author: new Types.ObjectId(authorId),
    status: ArticleStatus.Draft,
    publishedAt: null as Date | null,
    save: vi.fn(),
    deleteOne: vi.fn(),
    ...overrides,
  });

  let stored = makeArticle();
  const articleModel = {
    findById: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(stored) })),
    exists: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    find: vi.fn(() => {
      const query = {
        select: () => query,
        sort: () => query,
        skip: () => query,
        limit: () => query,
        exec: vi.fn().mockResolvedValue([]),
      };
      return query;
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
  const categoriesService = {
    registerUsageChecker: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    findIdBySlug: vi.fn(),
    findSummariesByIds: vi.fn().mockResolvedValue(new Map()),
  };
  const imagesService = {
    registerUsageChecker: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    findIdsByFilenames: vi.fn().mockResolvedValue(new Map()),
    findSummariesByIds: vi.fn().mockResolvedValue(new Map()),
  };
  const usersService = {
    findUsernamesByIds: vi.fn().mockResolvedValue(new Map()),
    findIdByUsername: vi.fn(),
  };
  const contentService = {
    process: vi.fn(() => ({
      html: '<p>x</p>',
      plainText: 'x',
      excerpt: 'x',
      imageFilenames: [] as string[],
    })),
  };

  const actor = (sub: string, role: Role) => ({
    sub,
    username: 'someone',
    email: 'someone@example.com',
    role,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    stored = makeArticle();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getModelToken(Article.name), useValue: articleModel },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: ImagesService, useValue: imagesService },
        { provide: UsersService, useValue: usersService },
        { provide: ArticleContentService, useValue: contentService },
      ],
    }).compile();
    service = moduleRef.get(ArticlesService);
  });

  const createDto = {
    title: 'The Battle of Didgori',
    content: '<p>x</p>',
    coverImageId: coverId,
    categoryId,
  };

  it('creates articles as drafts owned by the caller', async () => {
    articleModel.create.mockImplementation(async (data) => makeArticle(data));

    const result = await service.create(
      createDto,
      actor(authorId, Role.Moderator),
    );

    expect(articleModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'the-battle-of-didgori',
        status: ArticleStatus.Draft,
        author: authorId,
      }),
    );
    expect(result.status).toBe(ArticleStatus.Draft);
  });

  it('rejects an unknown category', async () => {
    categoriesService.exists.mockResolvedValueOnce(false);
    await expect(
      service.create(createDto, actor(authorId, Role.Moderator)),
    ).rejects.toThrow(new BadRequestException('Category does not exist'));
  });

  it('rejects content images that were never uploaded', async () => {
    contentService.process.mockReturnValueOnce({
      html: '',
      plainText: 'x',
      excerpt: 'x',
      imageFilenames: ['missing.jpg'],
    });
    await expect(
      service.create(createDto, actor(authorId, Role.Moderator)),
    ).rejects.toThrow(BadRequestException);
  });

  it("forbids moderators from editing someone else's article", async () => {
    await expect(
      service.update(
        stored._id.toString(),
        { title: 'Hijacked' },
        actor(new Types.ObjectId().toString(), Role.Moderator),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('lets admins edit any article', async () => {
    await service.update(
      stored._id.toString(),
      { title: 'Edited by admin' },
      actor(new Types.ObjectId().toString(), Role.Admin),
    );
    expect(stored.title).toBe('Edited by admin');
    expect(stored.save).toHaveBeenCalled();
  });

  it('keeps the slug stable after an article has been published', async () => {
    stored = makeArticle({ publishedAt: new Date('2026-01-01') });
    await service.update(
      stored._id.toString(),
      { title: 'A new title' },
      actor(authorId, Role.Moderator),
    );
    expect(stored.slug).toBe('didgori');
  });

  it('sets publishedAt only on the first publish', async () => {
    await service.publish(
      stored._id.toString(),
      actor(authorId, Role.Moderator),
    );
    const firstPublishedAt = stored.publishedAt;
    expect(stored.status).toBe(ArticleStatus.Published);
    expect(firstPublishedAt).toBeInstanceOf(Date);

    await service.unpublish(
      stored._id.toString(),
      actor(authorId, Role.Moderator),
    );
    await service.publish(
      stored._id.toString(),
      actor(authorId, Role.Moderator),
    );
    expect(stored.publishedAt).toBe(firstPublishedAt);
  });

  it('returns an empty page for an unknown category slug', async () => {
    categoriesService.findIdBySlug.mockResolvedValueOnce(null);
    const result = await service.listPublished({
      page: 1,
      limit: 20,
      category: 'nope',
    });
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it('filters published articles by category id', async () => {
    await service.listPublished({ page: 1, limit: 20, categoryId });
    expect(articleModel.find).toHaveBeenCalledWith({
      status: ArticleStatus.Published,
      category: categoryId,
    });
  });

  it('returns an empty page when category slug and id disagree', async () => {
    categoriesService.findIdBySlug.mockResolvedValueOnce(
      new Types.ObjectId().toString(),
    );
    articleModel.find.mockClear();
    const result = await service.listPublished({
      page: 1,
      limit: 20,
      category: 'history',
      categoryId,
    });
    expect(result.items).toEqual([]);
    expect(articleModel.find).not.toHaveBeenCalled();
  });

  it('filters managed articles by category id, scoped to the moderator', async () => {
    await service.listManaged(
      { page: 1, limit: 20, categoryId },
      actor(authorId, Role.Moderator),
    );
    expect(articleModel.find).toHaveBeenCalledWith({
      author: authorId,
      category: categoryId,
    });
  });
});
