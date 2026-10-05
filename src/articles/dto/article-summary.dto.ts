import { ApiProperty } from '@nestjs/swagger';
import { CategorySummaryDto } from '../../categories/dto/category-summary.dto.js';
import { ImageSummaryDto } from '../../images/dto/image-summary.dto.js';
import { ArticleStatus } from '../enums/article-status.enum.js';
import { AuthorSummaryDto } from './author-summary.dto.js';

export class ArticleSummaryDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80914' })
  id: string;

  @ApiProperty({ example: 'The Battle of Didgori' })
  title: string;

  @ApiProperty({ example: 'the-battle-of-didgori' })
  slug: string;

  @ApiProperty({
    example: 'In 1121, King David IV...',
    description: 'Plain-text summary (up to ~200 characters).',
  })
  excerpt: string;

  @ApiProperty({ type: ImageSummaryDto, nullable: true })
  coverImage: ImageSummaryDto | null;

  @ApiProperty({ type: CategorySummaryDto, nullable: true })
  category: CategorySummaryDto | null;

  @ApiProperty({
    type: CategorySummaryDto,
    nullable: true,
    description: 'Null when the article has no subcategory.',
  })
  subcategory: CategorySummaryDto | null;

  @ApiProperty({ type: [String], example: ['middle ages', 'georgia'] })
  tags: string[];

  @ApiProperty({ type: AuthorSummaryDto, nullable: true })
  author: AuthorSummaryDto | null;

  @ApiProperty({ enum: ArticleStatus })
  status: ArticleStatus;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-10-01T12:00:00.000Z',
    description: 'Set on first publish; null for never-published drafts.',
  })
  publishedAt: Date | null;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  updatedAt: Date;
}
