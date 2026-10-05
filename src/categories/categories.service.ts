import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { slugify } from '../common/utils/slugify.js';
import { CategoryBaseResponseDto } from './dto/category-base-response.dto.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';
import { CategorySummaryDto } from './dto/category-summary.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { CategoryRef } from './interfaces/category-ref.interface.js';
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

  /** Top-level categories, each with its subcategories nested. */
  async list(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryModel.find().sort({ name: 1 }).exec();
    const counts = await this.getUsageChecker().countPublishedArticles(
      categories.map((category) => category._id.toString()),
    );
    return categories
      .filter((category) => !category.parent)
      .map((category) =>
        this.toResponse(
          category,
          counts,
          null,
          categories.filter((child) => child.parent?.equals(category._id)),
        ),
      );
  }

  async findBySlug(slug: string): Promise<CategoryResponseDto> {
    const category = await this.categoryModel.findOne({ slug }).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.buildResponse(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const parent = dto.parentId
      ? await this.getParentOrThrow(dto.parentId)
      : null;
    const slug = this.buildSlug(dto.name);
    await this.assertNoConflict(dto.name, slug);

    try {
      const category = await this.categoryModel.create({
        name: dto.name,
        description: dto.description,
        slug,
        parent: parent?._id ?? null,
      });
      return this.toResponse(
        category,
        new Map(),
        parent ? toSummary(parent) : null,
        [],
      );
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
    return this.buildResponse(category);
  }

  async remove(id: string): Promise<void> {
    const subcategoryCount = await this.categoryModel.countDocuments({
      parent: id,
    });
    if (subcategoryCount > 0) {
      throw new ConflictException(
        `Category has ${subcategoryCount} subcategory(ies); delete them first`,
      );
    }
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

  async findRefBySlug(slug: string): Promise<CategoryRef | null> {
    const category = await this.categoryModel
      .findOne({ slug })
      .select('parent')
      .lean();
    return category ? toRef(category) : null;
  }

  async findRefsByIds(ids: string[]): Promise<Map<string, CategoryRef>> {
    const categories = await this.categoryModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .select('parent')
      .lean();
    return new Map(
      categories.map((category) => [category._id.toString(), toRef(category)]),
    );
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

  private async buildResponse(
    category: CategoryDocument,
  ): Promise<CategoryResponseDto> {
    const [parent, subcategories] = category.parent
      ? [await this.categoryModel.findById(category.parent).exec(), []]
      : [
          null,
          await this.categoryModel
            .find({ parent: category._id })
            .sort({ name: 1 })
            .exec(),
        ];
    const counts = await this.getUsageChecker().countPublishedArticles(
      [category, ...subcategories].map((item) => item._id.toString()),
    );
    return this.toResponse(
      category,
      counts,
      parent ? toSummary(parent) : null,
      subcategories,
    );
  }

  private async getParentOrThrow(id: string): Promise<CategoryDocument> {
    const parent = await this.categoryModel.findById(id).exec();
    if (!parent) {
      throw new BadRequestException('Parent category does not exist');
    }
    if (parent.parent) {
      throw new BadRequestException(
        'Subcategories cannot have their own subcategories',
      );
    }
    return parent;
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
    parent: CategorySummaryDto | null,
    subcategories: CategoryDocument[],
  ): CategoryResponseDto {
    const summary = toSummary(category);
    return {
      ...this.toBaseResponse(category, counts, parent),
      subcategories: subcategories.map((child) =>
        this.toBaseResponse(child, counts, summary),
      ),
    };
  }

  private toBaseResponse(
    category: CategoryDocument,
    counts: Map<string, number>,
    parent: CategorySummaryDto | null,
  ): CategoryBaseResponseDto {
    const id = category._id.toString();
    return {
      id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent,
      articleCount: counts.get(id) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

function toSummary(category: CategoryDocument): CategorySummaryDto {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
  };
}

function toRef(category: {
  _id: Types.ObjectId;
  parent?: Types.ObjectId | null;
}): CategoryRef {
  return {
    id: category._id.toString(),
    parentId: category.parent ? category.parent.toString() : null,
  };
}
