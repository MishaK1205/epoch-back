import { ApiProperty } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({ example: 'middle ages' })
  name: string;

  @ApiProperty({ example: 7, description: 'Number of published articles.' })
  count: number;
}
