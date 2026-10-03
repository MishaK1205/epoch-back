import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImageSummaryDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80912' })
  id: string;

  @ApiProperty({
    example:
      'http://localhost:3000/uploads/0b8f6c1e-4a52-4f0e-9a43-2a1f2b3c4d5e.jpg',
  })
  url: string;

  @ApiPropertyOptional({ example: 'Battle of Didgori painting' })
  alt?: string;
}
