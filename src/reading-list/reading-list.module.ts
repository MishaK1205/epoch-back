import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticlesModule } from '../articles/articles.module.js';
import { ReadingListController } from './reading-list.controller.js';
import { ReadingListService } from './reading-list.service.js';
import {
  ReadingListEntry,
  ReadingListEntrySchema,
} from './schemas/reading-list-entry.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReadingListEntry.name, schema: ReadingListEntrySchema },
    ]),
    ArticlesModule,
  ],
  controllers: [ReadingListController],
  providers: [ReadingListService],
})
export class ReadingListModule {}
