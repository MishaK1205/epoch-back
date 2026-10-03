import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ArticlesService } from '../articles/articles.service.js';
import { ReadingListType } from './enums/reading-list-type.enum.js';
import { ReadingListService } from './reading-list.service.js';
import { ReadingListEntry } from './schemas/reading-list-entry.schema.js';

describe('ReadingListService', () => {
  let service: ReadingListService;
  const userId = new Types.ObjectId().toString();
  const articleId = new Types.ObjectId().toString();

  let storedEntries: { article: Types.ObjectId; createdAt: Date }[] = [];
  const entryModel = {
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    find: vi.fn(() => {
      const query = {
        select: () => query,
        sort: () => query,
        lean: vi.fn(async () => storedEntries),
      };
      return query;
    }),
  };
  const articlesService = {
    registerDeletionListener: vi.fn(),
    isPublished: vi.fn().mockResolvedValue(true),
    findPublishedIds: vi.fn(),
    findPublishedSummariesByIds: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storedEntries = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReadingListService,
        { provide: getModelToken(ReadingListEntry.name), useValue: entryModel },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();
    service = moduleRef.get(ReadingListService);
  });

  it('upserts an entry for a published article', async () => {
    await service.add(userId, ReadingListType.Saved, articleId);
    expect(entryModel.updateOne).toHaveBeenCalledWith(
      { user: userId, list: ReadingListType.Saved, article: articleId },
      {},
      { upsert: true },
    );
  });

  it('rejects articles that are missing or not published', async () => {
    articlesService.isPublished.mockResolvedValueOnce(false);
    await expect(
      service.add(userId, ReadingListType.Read, articleId),
    ).rejects.toThrow(new NotFoundException('Article not found'));
    expect(entryModel.updateOne).not.toHaveBeenCalled();
  });

  it('treats a concurrent duplicate insert as success', async () => {
    entryModel.updateOne.mockRejectedValueOnce({
      code: 11000,
      keyPattern: { user: 1, list: 1, article: 1 },
    });
    await expect(
      service.add(userId, ReadingListType.Saved, articleId),
    ).resolves.toBeUndefined();
  });

  it('rethrows other database errors', async () => {
    entryModel.updateOne.mockRejectedValueOnce(new Error('boom'));
    await expect(
      service.add(userId, ReadingListType.Saved, articleId),
    ).rejects.toThrow('boom');
  });

  it('hides unpublished articles and paginates the visible ones', async () => {
    const [a, hidden, b, c] = [1, 2, 3, 4].map(() => new Types.ObjectId());
    storedEntries = [a, hidden, b, c].map((article, index) => ({
      article,
      createdAt: new Date(2026, 0, 10 - index),
    }));
    articlesService.findPublishedIds.mockResolvedValueOnce(
      new Set([a, b, c].map((id) => id.toString())),
    );
    articlesService.findPublishedSummariesByIds.mockImplementationOnce(
      async (ids: string[]) =>
        new Map(ids.map((id) => [id, { id, title: `Article ${id}` }])),
    );

    const result = await service.list(userId, ReadingListType.Saved, {
      page: 2,
      limit: 2,
    });

    expect(articlesService.findPublishedSummariesByIds).toHaveBeenCalledWith([
      c.toString(),
    ]);
    expect(result).toEqual({
      items: [
        {
          article: { id: c.toString(), title: `Article ${c.toString()}` },
          addedAt: storedEntries[3].createdAt,
        },
      ],
      total: 3,
      page: 2,
      limit: 2,
    });
  });

  it('removes all entries of a deleted article', async () => {
    await service.onArticleDeleted(articleId);
    expect(entryModel.deleteMany).toHaveBeenCalledWith({ article: articleId });
  });
});
