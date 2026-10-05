import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

// The parent is fixed at creation so articles never end up with a subcategory
// that belongs to a different category.
export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['parentId'] as const),
) {}
