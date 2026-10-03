import { ApiProperty } from '@nestjs/swagger';
import { ArticleSummaryDto } from '../../articles/dto/article-summary.dto.js';

export class ReadingListItemDto {
  @ApiProperty({ type: ArticleSummaryDto })
  article: ArticleSummaryDto;

  @ApiProperty({
    example: '2026-10-04T12:00:00.000Z',
    description: 'When the article was saved or marked as read.',
  })
  addedAt: Date;
}
