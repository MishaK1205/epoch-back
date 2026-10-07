import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class WhatWhereWhenCategory {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  createdAt: Date;
  updatedAt: Date;
}

export type WhatWhereWhenCategoryDocument =
  HydratedDocument<WhatWhereWhenCategory>;

export const WhatWhereWhenCategorySchema = SchemaFactory.createForClass(
  WhatWhereWhenCategory,
);

// Strength 2 ignores case, so "Cup" and "cup" can't both exist.
WhatWhereWhenCategorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
