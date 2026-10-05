import { ApiProperty } from '@nestjs/swagger';
import { CategoryBaseResponseDto } from './category-base-response.dto.js';

export class CategoryResponseDto extends CategoryBaseResponseDto {
  @ApiProperty({
    type: [CategoryBaseResponseDto],
    description:
      'Subcategories sorted by name; always empty for a subcategory itself.',
  })
  subcategories: CategoryBaseResponseDto[];
}
