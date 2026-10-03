import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ObjectIdParamDto {
  @ApiProperty({ example: '66f1c0d2a3b4c5d6e7f80912' })
  @IsMongoId()
  id: string;
}
