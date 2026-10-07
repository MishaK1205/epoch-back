import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticlesModule } from '../articles/articles.module.js';
import { ImagesModule } from '../images/images.module.js';
import {
  WhatWhereWhenCategory,
  WhatWhereWhenCategorySchema,
} from './schemas/what-where-when-category.schema.js';
import {
  WhatWhereWhenPackage,
  WhatWhereWhenPackageSchema,
} from './schemas/what-where-when-package.schema.js';
import { WhatWhereWhenCategoriesController } from './what-where-when-categories.controller.js';
import { WhatWhereWhenCategoriesService } from './what-where-when-categories.service.js';
import { WhatWhereWhenController } from './what-where-when.controller.js';
import { WhatWhereWhenService } from './what-where-when.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatWhereWhenPackage.name, schema: WhatWhereWhenPackageSchema },
      { name: WhatWhereWhenCategory.name, schema: WhatWhereWhenCategorySchema },
    ]),
    ArticlesModule,
    ImagesModule,
  ],
  controllers: [WhatWhereWhenController, WhatWhereWhenCategoriesController],
  providers: [WhatWhereWhenService, WhatWhereWhenCategoriesService],
})
export class WhatWhereWhenModule {}
