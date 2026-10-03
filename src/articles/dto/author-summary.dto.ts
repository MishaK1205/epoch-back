import { ApiProperty } from '@nestjs/swagger';

export class AuthorSummaryDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80912' })
  id: string;

  @ApiProperty({ example: 'master_elodin' })
  username: string;
}
