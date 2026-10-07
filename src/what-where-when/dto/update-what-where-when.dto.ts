import { PartialType } from '@nestjs/swagger';
import { CreateWhatWhereWhenDto } from './create-what-where-when.dto.js';

export class UpdateWhatWhereWhenDto extends PartialType(
  CreateWhatWhereWhenDto,
) {}
