import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/utils/mongo-errors.js';
import { CreateWhatWhereWhenCategoryDto } from './dto/create-what-where-when-category.dto.js';
import { UpdateWhatWhereWhenCategoryDto } from './dto/update-what-where-when-category.dto.js';
import { WhatWhereWhenCategoryResponseDto } from './dto/what-where-when-category-response.dto.js';
import { WhatWhereWhenCategorySummaryDto } from './dto/what-where-when-category-summary.dto.js';
import {
  WhatWhereWhenCategory,
  WhatWhereWhenCategoryDocument,
} from './schemas/what-where-when-category.schema.js';
import { WhatWhereWhenPackage } from './schemas/what-where-when-package.schema.js';

const DUPLICATE_NAME =
  'A What? Where? When? category with this name already exists';

@Injectable()
export class WhatWhereWhenCategoriesService {
  constructor(
    @InjectModel(WhatWhereWhenCategory.name)
    private readonly categoryModel: Model<WhatWhereWhenCategory>,
    @InjectModel(WhatWhereWhenPackage.name)
    private readonly packageModel: Model<WhatWhereWhenPackage>,
  ) {}

  async list(): Promise<WhatWhereWhenCategoryResponseDto[]> {
    const [categories, counts] = await Promise.all([
      this.categoryModel
        .find()
        .collation({ locale: 'en', strength: 2 })
        .sort({ name: 1 })
        .exec(),
      this.countPackages(),
    ]);
    return categories.map((category) => this.toResponse(category, counts));
  }

  async findOne(id: string): Promise<WhatWhereWhenCategoryResponseDto> {
    const category = await this.getOrThrow(id);
    return this.toResponse(category, await this.countPackages(id));
  }

  async create(
    dto: CreateWhatWhereWhenCategoryDto,
  ): Promise<WhatWhereWhenCategoryResponseDto> {
    try {
      const category = await this.categoryModel.create({
        name: dto.name,
        description: dto.description ?? '',
      });
      return this.toResponse(category, new Map());
    } catch (error) {
      throw translateDuplicate(error);
    }
  }

  async update(
    id: string,
    dto: UpdateWhatWhereWhenCategoryDto,
  ): Promise<WhatWhereWhenCategoryResponseDto> {
    const category = await this.getOrThrow(id);
    category.set(dto);
    try {
      await category.save();
    } catch (error) {
      throw translateDuplicate(error);
    }
    return this.toResponse(category, await this.countPackages(id));
  }

  async remove(id: string): Promise<void> {
    const category = await this.getOrThrow(id);
    const used = await this.packageModel.countDocuments({ category: id });
    if (used > 0) {
      throw new ConflictException(
        `Category is used by ${used} package(s); move or delete them first`,
      );
    }
    await category.deleteOne();
  }

  async exists(id: string): Promise<boolean> {
    return (await this.categoryModel.exists({ _id: id })) !== null;
  }

  async findSummariesByIds(
    ids: string[],
  ): Promise<Map<string, WhatWhereWhenCategorySummaryDto>> {
    if (ids.length === 0) {
      return new Map();
    }
    const categories = await this.categoryModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .select('name')
      .lean();
    return new Map(
      categories.map((category) => [
        category._id.toString(),
        { id: category._id.toString(), name: category.name },
      ]),
    );
  }

  private async countPackages(onlyId?: string): Promise<Map<string, number>> {
    const rows = await this.packageModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      {
        $match: onlyId
          ? { category: new Types.ObjectId(onlyId) }
          : { category: { $ne: null } },
      },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  private async getOrThrow(id: string): Promise<WhatWhereWhenCategoryDocument> {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('What? Where? When? category not found');
    }
    return category;
  }

  private toResponse(
    category: WhatWhereWhenCategoryDocument,
    counts: Map<string, number>,
  ): WhatWhereWhenCategoryResponseDto {
    const id = category._id.toString();
    return {
      id,
      name: category.name,
      description: category.description ?? '',
      packageCount: counts.get(id) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

function translateDuplicate(error: unknown): unknown {
  return isDuplicateKeyError(error)
    ? new ConflictException(DUPLICATE_NAME)
    : error;
}
