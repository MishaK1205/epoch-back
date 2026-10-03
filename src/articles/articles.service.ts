import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { CategoriesService } from '../categories/categories.service.js';
import type { CategoryUsageChecker } from '../categories/interfaces/category-usage-checker.interface.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { assertOwnerOrAdmin, isAdmin } from '../common/security/ownership.js';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { slugify, withRandomSuffix } from '../common/utils/slugify.js';
import { ImagesService } from '../images/images.service.js';
import type { ImageUsageChecker } from '../images/interfaces/image-usage-checker.interface.js';
import { UsersService } from '../users/users.service.js';
import { ArticleContentService } from './article-content.service.js';
import { ArticleResponseDto } from './dto/article-response.dto.js';
import { ArticleSummaryDto } from './dto/article-summary.dto.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { ListTagsQueryDto } from './dto/list-tags-query.dto.js';
import { ManageArticlesQueryDto } from './dto/manage-articles-query.dto.js';
import { PaginatedArticlesResponseDto } from './dto/paginated-articles-response.dto.js';
import { TagResponseDto } from './dto/tag-response.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { ArticleStatus } from './enums/article-status.enum.js';
import { Article, ArticleDocument } from './schemas/article.schema.js';

/** Slugs that would collide with static routes under /articles. */
const RESERVED_SLUGS = new Set(['manage']);
const SLUG_ATTEMPTS = 5;

@Injectable()
export class ArticlesService
  implements OnModuleInit, CategoryUsageChecker, ImageUsageChecker
{
  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<Article>,
    private readonly contentService: ArticleContentService,
    private readonly categoriesService: CategoriesService,
    private readonly imagesService: ImagesService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    this.categoriesService.registerUsageChecker(this);
    this.imagesService.registerUsageChecker(this);
  }

  async listPublished(
    query: ListArticlesQueryDto,
  ): Promise<PaginatedArticlesResponseDto> {
    const filter: QueryFilter<Article> = { status: ArticleStatus.Published };

    if (query.category) {
      const categoryId = await this.categoriesService.findIdBySlug(
        query.category,
      );
      if (
        !categoryId ||
        (query.categoryId && query.categoryId !== categoryId)
      ) {
        return emptyPage(query);
      }
      filter.category = categoryId;
    } else if (query.categoryId) {
      filter.category = query.categoryId;
    }
    if (query.author) {
      const authorId = await this.usersService.findIdByUsername(query.author);
      if (!authorId) {
        return emptyPage(query);
      }
      filter.author = authorId;
    }
    if (query.tag) {
      filter.tags = query.tag;
    }
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    return this.paginate(filter, { publishedAt: -1 }, query);
  }

  async findPublishedBySlug(slug: string): Promise<ArticleResponseDto> {
    const article = await this.articleModel
      .findOne({ slug, status: ArticleStatus.Published })
      .exec();
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return (await this.toResponses([article], true))[0] as ArticleResponseDto;
  }

  async listManaged(
    query: ManageArticlesQueryDto,
    actor: JwtPayload,
  ): Promise<PaginatedArticlesResponseDto> {
    const filter: QueryFilter<Article> = isAdmin(actor)
      ? {}
      : { author: actor.sub };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.categoryId) {
      filter.category = query.categoryId;
    }
    return this.paginate(filter, { updatedAt: -1 }, query);
  }

  async findManaged(
    id: string,
    actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    const article = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, article.author.toString());
    return this.toFullResponse(article);
  }

  async create(
    dto: CreateArticleDto,
    actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    await Promise.all([
      this.assertCategoryExists(dto.categoryId),
      this.assertImageExists(dto.coverImageId),
    ]);
    const content = await this.processContent(dto.content);

    try {
      const article = await this.articleModel.create({
        title: dto.title,
        slug: await this.generateUniqueSlug(dto.title),
        ...content,
        coverImage: dto.coverImageId,
        category: dto.categoryId,
        tags: dto.tags ?? [],
        author: actor.sub,
        status: ArticleStatus.Draft,
      });
      return this.toFullResponse(article);
    } catch (error) {
      throw translateDuplicateKey(error);
    }
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    actor: JwtPayload,
  ): Promise<ArticleResponseDto> {
    const article = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, article.author.toString());

    if (dto.title !== undefined && dto.title !== article.title) {
      article.title = dto.title;
      // Keep URLs stable once an article has been public.
      if (!article.publishedAt) {
        article.slug = await this.generateUniqueSlug(dto.title, id);
      }
    }
    if (dto.content !== undefined) {
      Object.assign(article, await this.processContent(dto.content));
    }
    if (dto.coverImageId !== undefined) {
      await this.assertImageExists(dto.coverImageId);
      article.coverImage = new Types.ObjectId(dto.coverImageId);
    }
    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
      article.category = new Types.ObjectId(dto.categoryId);
    }
    if (dto.tags !== undefined) {
      article.tags = dto.tags;
    }

    try {
      await article.save();
    } catch (error) {
      throw translateDuplicateKey(error);
    }
    return this.toFullResponse(article);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const article = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, article.author.toString());
    await article.deleteOne();
  }

  async publish(id: string, actor: JwtPayload): Promise<ArticleResponseDto> {
    const article = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, article.author.toString());
    article.status = ArticleStatus.Published;
    article.publishedAt ??= new Date();
    await article.save();
    return this.toFullResponse(article);
  }

  async unpublish(id: string, actor: JwtPayload): Promise<ArticleResponseDto> {
    const article = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, article.author.toString());
    article.status = ArticleStatus.Draft;
    await article.save();
    return this.toFullResponse(article);
  }

  async listTags(query: ListTagsQueryDto): Promise<TagResponseDto[]> {
    return this.articleModel.aggregate<TagResponseDto>([
      { $match: { status: ArticleStatus.Published } },
      { $unwind: '$tags' },
      ...(query.q
        ? [{ $match: { tags: { $regex: `^${escapeRegex(query.q)}` } } }]
        : []),
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: query.limit },
      { $project: { _id: 0, name: '$_id', count: '$count' } },
    ]);
  }

  async countArticles(categoryId: string): Promise<number> {
    return this.articleModel.countDocuments({ category: categoryId });
  }

  async countPublishedArticles(
    categoryIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.articleModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      {
        $match: {
          status: ArticleStatus.Published,
          category: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
        },
      },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  async isImageInUse(imageId: string): Promise<boolean> {
    const used = await this.articleModel.exists({
      $or: [{ coverImage: imageId }, { contentImages: imageId }],
    });
    return used !== null;
  }

  private async paginate(
    filter: QueryFilter<Article>,
    sort: Record<string, 1 | -1>,
    query: { page: number; limit: number },
  ): Promise<PaginatedArticlesResponseDto> {
    const [articles, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .select('-content')
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.articleModel.countDocuments(filter),
    ]);
    return {
      items: await this.toResponses(articles, false),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async processContent(rawHtml: string) {
    const processed = this.contentService.process(rawHtml);
    const idsByFilename = await this.imagesService.findIdsByFilenames(
      processed.imageFilenames,
    );
    const missing = processed.imageFilenames.filter(
      (filename) => !idsByFilename.has(filename),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Content references images that do not exist: ${missing.join(', ')}`,
      );
    }
    return {
      content: processed.html,
      plainText: processed.plainText,
      excerpt: processed.excerpt,
      contentImages: [...idsByFilename.values()].map(
        (id) => new Types.ObjectId(id),
      ),
    };
  }

  private async generateUniqueSlug(
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const base = slugify(title) || 'article';
    let candidate = RESERVED_SLUGS.has(base) ? withRandomSuffix(base) : base;

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
      const taken = await this.articleModel.exists({
        slug: candidate,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      });
      if (!taken) {
        return candidate;
      }
      candidate = withRandomSuffix(base);
    }
    throw new ConflictException(
      'Could not generate a unique slug; try a different title',
    );
  }

  private async assertCategoryExists(id: string): Promise<void> {
    if (!(await this.categoriesService.exists(id))) {
      throw new BadRequestException('Category does not exist');
    }
  }

  private async assertImageExists(id: string): Promise<void> {
    if (!(await this.imagesService.exists(id))) {
      throw new BadRequestException('Cover image does not exist');
    }
  }

  private async getOrThrow(id: string): Promise<ArticleDocument> {
    const article = await this.articleModel.findById(id).exec();
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  private async toFullResponse(
    article: ArticleDocument,
  ): Promise<ArticleResponseDto> {
    return (await this.toResponses([article], true))[0] as ArticleResponseDto;
  }

  /** Resolves author, category and cover image with one query each. */
  private async toResponses(
    articles: ArticleDocument[],
    withContent: boolean,
  ): Promise<ArticleSummaryDto[]> {
    const [authors, categories, images] = await Promise.all([
      this.usersService.findUsernamesByIds(
        articles.map((article) => article.author.toString()),
      ),
      this.categoriesService.findSummariesByIds(
        articles.map((article) => article.category.toString()),
      ),
      this.imagesService.findSummariesByIds(
        articles.map((article) => article.coverImage.toString()),
      ),
    ]);

    return articles.map((article) => {
      const authorId = article.author.toString();
      const username = authors.get(authorId);
      const summary: ArticleSummaryDto = {
        id: article._id.toString(),
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        coverImage: images.get(article.coverImage.toString()) ?? null,
        category: categories.get(article.category.toString()) ?? null,
        tags: article.tags,
        author: username ? { id: authorId, username } : null,
        status: article.status,
        publishedAt: article.publishedAt,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      };
      return withContent ? { ...summary, content: article.content } : summary;
    });
  }
}

function emptyPage(query: {
  page: number;
  limit: number;
}): PaginatedArticlesResponseDto {
  return { items: [], total: 0, page: query.page, limit: query.limit };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function translateDuplicateKey(error: unknown): unknown {
  return isDuplicateKeyError(error)
    ? new ConflictException(
        'An article with this slug already exists; please retry',
      )
    : error;
}
