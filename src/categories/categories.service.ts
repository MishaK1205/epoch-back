import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { slugify } from '../common/utils/slugify.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { CategorySummaryDto } from './dto/category-summary.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { CategoryUsageChecker } from './interfaces/category-usage-checker.interface.js';
import { Category, CategoryDocument } from './schemas/category.schema.js';

@Injectable()
export class CategoriesService {
  private usageChecker?: CategoryUsageChecker;

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  /** Called by ArticlesModule at startup; avoids a circular module import. */
  registerUsageChecker(checker: CategoryUsageChecker): void {
    this.usageChecker = checker;
  }

  async list(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryModel.find().sort({ name: 1 }).exec();
    const counts = await this.getUsageChecker().countPublishedArticles(
      categories.map((category) => category._id.toString()),
    );
    return categories.map((category) => this.toResponse(category, counts));
  }

  async findBySlug(slug: string): Promise<CategoryResponseDto> {
    const category = await this.categoryModel.findOne({ slug }).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    const counts = await this.getUsageChecker().countPublishedArticles([
      category._id.toString(),
    ]);
    return this.toResponse(category, counts);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = this.buildSlug(dto.name);
    await this.assertNoConflict(dto.name, slug);

    try {
      const category = await this.categoryModel.create({ ...dto, slug });
      return this.toResponse(category, new Map());
    } catch (error) {
      throw this.translateDuplicateKey(error);
    }
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name !== undefined && dto.name !== category.name) {
      const slug = this.buildSlug(dto.name);
      await this.assertNoConflict(dto.name, slug, id);
      category.name = dto.name;
      category.slug = slug;
    }
    if (dto.description !== undefined) {
      category.description = dto.description;
    }

    try {
      await category.save();
    } catch (error) {
      throw this.translateDuplicateKey(error);
    }
    const counts = await this.getUsageChecker().countPublishedArticles([id]);
    return this.toResponse(category, counts);
  }

  async remove(id: string): Promise<void> {
    const articleCount = await this.getUsageChecker().countArticles(id);
    if (articleCount > 0) {
      throw new ConflictException(
        `Category is used by ${articleCount} article(s); move or delete them first`,
      );
    }
    const deleted = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Category not found');
    }
  }

  async exists(id: string): Promise<boolean> {
    return (await this.categoryModel.exists({ _id: id })) !== null;
  }

  async findIdBySlug(slug: string): Promise<string | null> {
    const category = await this.categoryModel
      .findOne({ slug })
      .select('_id')
      .lean();
    return category ? category._id.toString() : null;
  }

  async findSummariesByIds(
    ids: string[],
  ): Promise<Map<string, CategorySummaryDto>> {
    const categories = await this.categoryModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .select('name slug')
      .lean();
    return new Map(
      categories.map((category) => {
        const id = category._id.toString();
        return [id, { id, name: category.name, slug: category.slug }];
      }),
    );
  }

  private getUsageChecker(): CategoryUsageChecker {
    if (!this.usageChecker) {
      throw new Error('CategoryUsageChecker has not been registered');
    }
    return this.usageChecker;
  }

  private buildSlug(name: string): string {
    const slug = slugify(name);
    if (!slug) {
      throw new BadRequestException(
        'Category name must contain letters or numbers',
      );
    }
    return slug;
  }

  private async assertNoConflict(
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const filter = {
      $or: [{ name }, { slug }],
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    };
    if (await this.categoryModel.exists(filter)) {
      throw new ConflictException('A category with this name already exists');
    }
  }

  private translateDuplicateKey(error: unknown): unknown {
    return isDuplicateKeyError(error)
      ? new ConflictException('A category with this name already exists')
      : error;
  }

  private toResponse(
    category: CategoryDocument,
    counts: Map<string, number>,
  ): CategoryResponseDto {
    const id = category._id.toString();
    return {
      id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      articleCount: counts.get(id) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
