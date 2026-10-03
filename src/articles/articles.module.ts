import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from '../categories/categories.module.js';
import { ImagesModule } from '../images/images.module.js';
import { UsersModule } from '../users/users.module.js';
import { ArticleContentService } from './article-content.service.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
import { Article, ArticleSchema } from './schemas/article.schema.js';
import { TagsController } from './tags.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Article.name, schema: ArticleSchema }]),
    CategoriesModule,
    ImagesModule,
    UsersModule,
  ],
  controllers: [ArticlesController, TagsController],
  providers: [ArticlesService, ArticleContentService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
