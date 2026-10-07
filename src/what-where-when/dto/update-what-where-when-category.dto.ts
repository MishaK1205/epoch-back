import { PartialType } from '@nestjs/swagger';
import { CreateWhatWhereWhenCategoryDto } from './create-what-where-when-category.dto.js';

export class UpdateWhatWhereWhenCategoryDto extends PartialType(
  CreateWhatWhereWhenCategoryDto,
) {}
