import { ApiProperty } from '@nestjs/swagger';
import { ImageSummaryDto } from './image-summary.dto.js';

export class ImageResponseDto extends ImageSummaryDto {
  @ApiProperty({ example: '0b8f6c1e-4a52-4f0e-9a43-2a1f2b3c4d5e.jpg' })
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ example: 245310, description: 'File size in bytes.' })
  size: number;

  @ApiProperty({
    example: '66f1c0d2a3b4c5d6e7f80912',
    description: 'Id of the user who uploaded the image.',
  })
  uploadedBy: string;

  @ApiProperty({ example: '2026-10-01T12:00:00.000Z' })
  createdAt: Date;
}
