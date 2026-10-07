import { ApiProperty } from '@nestjs/swagger';
import { WhatWhereWhenQuestionResponseDto } from './what-where-when-question-response.dto.js';
import { WhatWhereWhenSummaryDto } from './what-where-when-summary.dto.js';

export class WhatWhereWhenResponseDto extends WhatWhereWhenSummaryDto {
  @ApiProperty({
    type: [WhatWhereWhenQuestionResponseDto],
    description: 'In the order they are asked.',
  })
  questions: WhatWhereWhenQuestionResponseDto[];
}
