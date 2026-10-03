import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Image {
  @Prop({ required: true, unique: true })
  filename: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ trim: true })
  alt?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploadedBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export type ImageDocument = HydratedDocument<Image>;

export const ImageSchema = SchemaFactory.createForClass(Image);
