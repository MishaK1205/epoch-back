import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  WhatWhereWhenQuestion,
  WhatWhereWhenQuestionSchema,
} from './what-where-when-question.schema.js';

@Schema({ timestamps: true })
export class WhatWhereWhenPackage {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [String], default: [] })
  authors: string[];

  /** Optional; missing on packages created before categories existed. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WhatWhereWhenCategory',
    default: null,
    index: true,
  })
  category: Types.ObjectId | null;

  /** Calendar date as `YYYY-MM-DD`, so string order is date order. */
  @Prop({ required: true })
  date: string;

  /** In the order they are asked. */
  @Prop({ type: [WhatWhereWhenQuestionSchema], default: [] })
  questions: WhatWhereWhenQuestion[];

  /** Images referenced inside any question, recomputed when questions change. */
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Image' }],
    default: [],
    index: true,
  })
  images: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

export type WhatWhereWhenPackageDocument =
  HydratedDocument<WhatWhereWhenPackage>;

export const WhatWhereWhenPackageSchema =
  SchemaFactory.createForClass(WhatWhereWhenPackage);

WhatWhereWhenPackageSchema.index({ date: -1, createdAt: -1 });
