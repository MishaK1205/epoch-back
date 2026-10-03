import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<Category>;

export const CategorySchema = SchemaFactory.createForClass(Category);
