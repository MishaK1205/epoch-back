import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ReadingListType } from '../enums/reading-list-type.enum.js';

@Schema({ timestamps: true })
export class ReadingListEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true,
  })
  article: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ReadingListType), required: true })
  list: ReadingListType;

  createdAt: Date;
  updatedAt: Date;
}

export type ReadingListEntryDocument = HydratedDocument<ReadingListEntry>;

export const ReadingListEntrySchema =
  SchemaFactory.createForClass(ReadingListEntry);

ReadingListEntrySchema.index(
  { user: 1, list: 1, article: 1 },
  { unique: true },
);
ReadingListEntrySchema.index({ user: 1, list: 1, createdAt: -1 });
