import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';
import { Image, ImageSchema } from './schemas/image.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Image.name, schema: ImageSchema }]),
    // No storage option: files stay in memory so their content can be
    // type-checked before ImagesService writes them to disk.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize:
            configService.getOrThrow<number>('MAX_UPLOAD_SIZE_MB') *
            1024 *
            1024,
          files: 1,
        },
      }),
    }),
  ],
  controllers: [ImagesController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}
