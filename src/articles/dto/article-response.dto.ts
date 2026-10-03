import { ApiProperty } from '@nestjs/swagger';
import { ArticleSummaryDto } from './article-summary.dto.js';

export class ArticleResponseDto extends ArticleSummaryDto {
  @ApiProperty({
    example: '<p>In 1121, King David IV...</p>',
    description: 'Sanitized HTML, safe to render directly.',
  })
  content: string;
}
