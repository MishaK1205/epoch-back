import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class WhatWhereWhenQuestion {
  /** Sanitized Quill HTML; may contain images from our uploads. */
  @Prop({ required: true })
  question: string;

  @Prop({ required: true, trim: true })
  answer: string;

  @Prop({ default: '', trim: true })
  comment: string;
}

export const WhatWhereWhenQuestionSchema = SchemaFactory.createForClass(
  WhatWhereWhenQuestion,
);
