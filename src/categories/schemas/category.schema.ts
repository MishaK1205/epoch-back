import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  /**
   * Set for subcategories, null for top-level categories. Documents created
   * before subcategories existed have no field at all, which `{ parent: null }`
   * also matches.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true,
  })
  parent: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<Category>;

export const CategorySchema = SchemaFactory.createForClass(Category);
