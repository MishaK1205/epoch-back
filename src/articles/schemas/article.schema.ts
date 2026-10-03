import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ArticleStatus } from '../enums/article-status.enum.js';

@Schema({ timestamps: true })
export class Article {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  content: string;

  /** Text-only copy of `content`, used for full-text search. */
  @Prop({ required: true, select: false })
  plainText: string;

  @Prop({ default: '' })
  excerpt: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Image',
    required: true,
    index: true,
  })
  coverImage: Types.ObjectId;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Image' }],
    default: [],
    index: true,
  })
  contentImages: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category: Types.ObjectId;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  author: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ArticleStatus),
    default: ArticleStatus.Draft,
  })
  status: ArticleStatus;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type ArticleDocument = HydratedDocument<Article>;

export const ArticleSchema = SchemaFactory.createForClass(Article);

ArticleSchema.index({ status: 1, publishedAt: -1 });
// 'none' disables English stemming, which would mangle Georgian and other text.
ArticleSchema.index(
  { title: 'text', plainText: 'text' },
  { weights: { title: 5, plainText: 1 }, default_language: 'none' },
);
