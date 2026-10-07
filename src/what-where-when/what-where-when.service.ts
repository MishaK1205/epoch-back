import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { ArticleContentService } from '../articles/article-content.service.js';
import { ImagesService } from '../images/images.service.js';
import type { ImageUsageChecker } from '../images/interfaces/image-usage-checker.interface.js';
import { CreateWhatWhereWhenDto } from './dto/create-what-where-when.dto.js';
import { ListWhatWhereWhenQueryDto } from './dto/list-what-where-when-query.dto.js';
import { PaginatedWhatWhereWhenResponseDto } from './dto/paginated-what-where-when-response.dto.js';
import { UpdateWhatWhereWhenDto } from './dto/update-what-where-when.dto.js';
import { WhatWhereWhenCategorySummaryDto } from './dto/what-where-when-category-summary.dto.js';
import { WhatWhereWhenQuestionDto } from './dto/what-where-when-question.dto.js';
import { WhatWhereWhenResponseDto } from './dto/what-where-when-response.dto.js';
import { WhatWhereWhenSummaryDto } from './dto/what-where-when-summary.dto.js';
import {
  WhatWhereWhenPackage,
  WhatWhereWhenPackageDocument,
} from './schemas/what-where-when-package.schema.js';
import type { WhatWhereWhenQuestion } from './schemas/what-where-when-question.schema.js';
import { WhatWhereWhenCategoriesService } from './what-where-when-categories.service.js';

interface SummaryRow {
  _id: Types.ObjectId;
  name: string;
  authors: string[];
  category?: Types.ObjectId | null;
  date: string;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProcessedQuestions {
  questions: WhatWhereWhenQuestion[];
  images: Types.ObjectId[];
}

@Injectable()
export class WhatWhereWhenService implements OnModuleInit, ImageUsageChecker {
  constructor(
    @InjectModel(WhatWhereWhenPackage.name)
    private readonly packageModel: Model<WhatWhereWhenPackage>,
    private readonly contentService: ArticleContentService,
    private readonly imagesService: ImagesService,
    private readonly categoriesService: WhatWhereWhenCategoriesService,
  ) {}

  onModuleInit(): void {
    this.imagesService.registerUsageChecker(
      this,
      'Image is used by a What? Where? When? package; remove it from the package first',
    );
  }

  /** Newest date first; questions are left out, only their count is returned. */
  async list(
    query: ListWhatWhereWhenQueryDto,
  ): Promise<PaginatedWhatWhereWhenResponseDto> {
    const filter: QueryFilter<WhatWhereWhenPackage> = query.categoryId
      ? { category: new Types.ObjectId(query.categoryId) }
      : {};
    const [rows, total] = await Promise.all([
      this.packageModel.aggregate<SummaryRow>([
        { $match: filter },
        { $sort: { date: -1, createdAt: -1 } },
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
        {
          $project: {
            name: 1,
            authors: 1,
            category: 1,
            date: 1,
            createdAt: 1,
            updatedAt: 1,
            questionCount: { $size: { $ifNull: ['$questions', []] } },
          },
        },
      ]),
      this.packageModel.countDocuments(filter),
    ]);
    const categories = await this.loadCategories(rows);
    return {
      items: rows.map((row) => toSummary(row, categories)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<WhatWhereWhenResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async create(dto: CreateWhatWhereWhenDto): Promise<WhatWhereWhenResponseDto> {
    const category = await this.resolveCategory(dto.categoryId);
    const processed = await this.processQuestions(dto.questions ?? []);
    const created = await this.packageModel.create({
      name: dto.name,
      authors: dto.authors ?? [],
      category: category ?? null,
      date: dto.date,
      ...processed,
    });
    return this.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateWhatWhereWhenDto,
  ): Promise<WhatWhereWhenResponseDto> {
    const existing = await this.getOrThrow(id);
    const { questions, categoryId, ...fields } = dto;
    existing.set(fields);
    if (categoryId !== undefined) {
      existing.category = (await this.resolveCategory(categoryId)) ?? null;
    }
    if (questions !== undefined) {
      existing.set(await this.processQuestions(questions));
    }
    await existing.save();
    return this.toResponse(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getOrThrow(id);
    await existing.deleteOne();
  }

  async isImageInUse(imageId: string): Promise<boolean> {
    return (await this.packageModel.exists({ images: imageId })) !== null;
  }

  /** `undefined`/`null` means "no category"; an unknown id is a 400. */
  private async resolveCategory(
    categoryId: string | null | undefined,
  ): Promise<Types.ObjectId | undefined> {
    if (!categoryId) {
      return undefined;
    }
    if (!(await this.categoriesService.exists(categoryId))) {
      throw new BadRequestException('Category does not exist');
    }
    return new Types.ObjectId(categoryId);
  }

  private async processQuestions(
    input: WhatWhereWhenQuestionDto[],
  ): Promise<ProcessedQuestions> {
    const processed = input.map((item, index) => ({
      item,
      content: this.contentService.process(
        item.question,
        `Question ${index + 1} cannot be empty`,
      ),
    }));

    const filenames = [
      ...new Set(processed.flatMap(({ content }) => content.imageFilenames)),
    ];
    const idsByFilename =
      await this.imagesService.findIdsByFilenames(filenames);
    const images: Types.ObjectId[] = [];
    const missing: string[] = [];
    for (const name of filenames) {
      const id = idsByFilename.get(name);
      if (id) {
        images.push(new Types.ObjectId(id));
      } else {
        missing.push(name);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `Questions reference images that do not exist: ${missing.join(', ')}`,
      );
    }

    return {
      questions: processed.map(({ item, content }) => ({
        question: content.html,
        answer: item.answer,
        comment: item.comment ?? '',
      })),
      images,
    };
  }

  private loadCategories(
    rows: Pick<SummaryRow, 'category'>[],
  ): Promise<Map<string, WhatWhereWhenCategorySummaryDto>> {
    return this.categoriesService.findSummariesByIds(
      rows.flatMap((row) => (row.category ? [row.category.toString()] : [])),
    );
  }

  private async getOrThrow(id: string): Promise<WhatWhereWhenPackageDocument> {
    const found = await this.packageModel.findById(id).exec();
    if (!found) {
      throw new NotFoundException('What? Where? When? package not found');
    }
    return found;
  }

  private async toResponse(
    document: WhatWhereWhenPackageDocument,
  ): Promise<WhatWhereWhenResponseDto> {
    const row: SummaryRow = {
      _id: document._id,
      name: document.name,
      authors: document.authors,
      category: document.category,
      date: document.date,
      questionCount: document.questions.length,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
    return {
      ...toSummary(row, await this.loadCategories([row])),
      questions: document.questions.map((item) => ({
        question: item.question,
        answer: item.answer,
        comment: item.comment ?? '',
      })),
    };
  }
}

function toSummary(
  row: SummaryRow,
  categories: Map<string, WhatWhereWhenCategorySummaryDto>,
): WhatWhereWhenSummaryDto {
  return {
    id: row._id.toString(),
    name: row.name,
    authors: [...row.authors],
    category: row.category
      ? (categories.get(row.category.toString()) ?? null)
      : null,
    date: row.date,
    questionCount: row.questionCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
