import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ArticlesService } from '../articles/articles.service.js';
import type { ArticleDeletionListener } from '../articles/interfaces/article-deletion-listener.interface.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { PaginatedReadingListResponseDto } from './dto/paginated-reading-list-response.dto.js';
import { ReadingListItemDto } from './dto/reading-list-item.dto.js';
import { ReadingListType } from './enums/reading-list-type.enum.js';
import { ReadingListEntry } from './schemas/reading-list-entry.schema.js';

@Injectable()
export class ReadingListService
  implements OnModuleInit, ArticleDeletionListener
{
  constructor(
    @InjectModel(ReadingListEntry.name)
    private readonly entryModel: Model<ReadingListEntry>,
    private readonly articlesService: ArticlesService,
  ) {}

  onModuleInit(): void {
    this.articlesService.registerDeletionListener(this);
  }

  /** Idempotent: adding an article twice keeps the original `addedAt`. */
  async add(
    userId: string,
    list: ReadingListType,
    articleId: string,
  ): Promise<void> {
    if (!(await this.articlesService.isPublished(articleId))) {
      throw new NotFoundException('Article not found');
    }
    try {
      await this.entryModel.updateOne(
        { user: userId, list, article: articleId },
        {},
        { upsert: true },
      );
    } catch (error) {
      // A concurrent identical request inserted it first; the result is the same.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  /** Idempotent: removing an article that isn't in the list is not an error. */
  async remove(
    userId: string,
    list: ReadingListType,
    articleId: string,
  ): Promise<void> {
    await this.entryModel.deleteOne({ user: userId, list, article: articleId });
  }

  /**
   * Newest first. Articles that are no longer published stay stored (they
   * reappear if republished) but are hidden and excluded from `total`.
   */
  async list(
    userId: string,
    list: ReadingListType,
    query: PaginationQueryDto,
  ): Promise<PaginatedReadingListResponseDto> {
    const entries = await this.entryModel
      .find({ user: userId, list })
      .select('article createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    const publishedIds = await this.articlesService.findPublishedIds(
      entries.map((entry) => entry.article.toString()),
    );
    const visible = entries.filter((entry) =>
      publishedIds.has(entry.article.toString()),
    );
    const start = (query.page - 1) * query.limit;
    const pageEntries = visible.slice(start, start + query.limit);

    const summaries = await this.articlesService.findPublishedSummariesByIds(
      pageEntries.map((entry) => entry.article.toString()),
    );
    const items = pageEntries.flatMap((entry): ReadingListItemDto[] => {
      const article = summaries.get(entry.article.toString());
      return article ? [{ article, addedAt: entry.createdAt }] : [];
    });

    return {
      items,
      total: visible.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async onArticleDeleted(articleId: string): Promise<void> {
    await this.entryModel.deleteMany({ article: articleId });
  }
}
