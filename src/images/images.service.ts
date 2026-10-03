import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { UPLOADS_URL_PREFIX } from '../common/constants/uploads.constants.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { assertOwnerOrAdmin, isAdmin } from '../common/security/ownership.js';
import { ImageResponseDto } from './dto/image-response.dto.js';
import { ImageSummaryDto } from './dto/image-summary.dto.js';
import { PaginatedImagesResponseDto } from './dto/paginated-images-response.dto.js';
import type { ImageUsageChecker } from './interfaces/image-usage-checker.interface.js';
import { Image, ImageDocument } from './schemas/image.schema.js';

export const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const UPLOAD_FILENAME = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly logger = new Logger(ImagesService.name);
  private readonly uploadDir: string;
  private readonly publicBaseUrl: string;
  private usageChecker?: ImageUsageChecker;

  constructor(
    @InjectModel(Image.name) private readonly imageModel: Model<Image>,
    configService: ConfigService,
  ) {
    this.uploadDir = resolve(configService.getOrThrow<string>('UPLOAD_DIR'));
    this.publicBaseUrl = configService.getOrThrow<string>('PUBLIC_BASE_URL');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
  }

  /** Called by ArticlesModule at startup; avoids a circular module import. */
  registerUsageChecker(checker: ImageUsageChecker): void {
    this.usageChecker = checker;
  }

  async upload(
    file: UploadedImageFile,
    alt: string | undefined,
    actor: JwtPayload,
  ): Promise<ImageResponseDto> {
    const filename = `${randomUUID()}.${EXTENSIONS[file.mimetype]}`;
    const path = join(this.uploadDir, filename);
    await writeFile(path, file.buffer);

    try {
      const image = await this.imageModel.create({
        filename,
        mimeType: file.mimetype,
        size: file.size,
        alt: alt || undefined,
        uploadedBy: actor.sub,
      });
      return this.toResponse(image);
    } catch (error) {
      await this.deleteFile(filename);
      throw error;
    }
  }

  async list(
    query: PaginationQueryDto,
    actor: JwtPayload,
  ): Promise<PaginatedImagesResponseDto> {
    const filter = isAdmin(actor) ? {} : { uploadedBy: actor.sub };
    const [images, total] = await Promise.all([
      this.imageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.imageModel.countDocuments(filter),
    ]);
    return {
      items: images.map((image) => this.toResponse(image)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<ImageResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async updateAlt(
    id: string,
    alt: string,
    actor: JwtPayload,
  ): Promise<ImageResponseDto> {
    const image = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, image.uploadedBy.toString());
    image.alt = alt || undefined;
    await image.save();
    return this.toResponse(image);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const image = await this.getOrThrow(id);
    assertOwnerOrAdmin(actor, image.uploadedBy.toString());

    if (await this.getUsageChecker().isImageInUse(id)) {
      throw new ConflictException(
        'Image is used by an article; remove it from the article first',
      );
    }
    await image.deleteOne();
    await this.deleteFile(image.filename);
  }

  async exists(id: string): Promise<boolean> {
    return (await this.imageModel.exists({ _id: id })) !== null;
  }

  async findSummariesByIds(
    ids: string[],
  ): Promise<Map<string, ImageSummaryDto>> {
    const images = await this.imageModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .exec();
    return new Map(
      images.map((image) => [image._id.toString(), this.toSummary(image)]),
    );
  }

  /** Maps upload filenames to image ids; unknown filenames are omitted. */
  async findIdsByFilenames(filenames: string[]): Promise<Map<string, string>> {
    const images = await this.imageModel
      .find({ filename: { $in: [...new Set(filenames)] } })
      .select('filename')
      .lean();
    return new Map(
      images.map((image) => [image.filename, image._id.toString()]),
    );
  }

  getPublicUrl(filename: string): string {
    return `${this.publicBaseUrl}${UPLOADS_URL_PREFIX}/${filename}`;
  }

  /**
   * Returns the upload filename if `src` points at one of our uploads
   * (absolute with PUBLIC_BASE_URL, or a relative /uploads/ path), else null.
   */
  extractUploadFilename(src: string): string | null {
    const prefixes = [
      `${this.publicBaseUrl}${UPLOADS_URL_PREFIX}/`,
      `${UPLOADS_URL_PREFIX}/`,
    ];
    const prefix = prefixes.find((candidate) => src.startsWith(candidate));
    if (!prefix) {
      return null;
    }
    const filename = src.slice(prefix.length);
    return UPLOAD_FILENAME.test(filename) ? filename : null;
  }

  private async getOrThrow(id: string): Promise<ImageDocument> {
    const image = await this.imageModel.findById(id).exec();
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    return image;
  }

  private getUsageChecker(): ImageUsageChecker {
    if (!this.usageChecker) {
      throw new Error('ImageUsageChecker has not been registered');
    }
    return this.usageChecker;
  }

  private async deleteFile(filename: string): Promise<void> {
    try {
      await unlink(join(this.uploadDir, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete upload ${filename}`, error);
      }
    }
  }

  private toSummary(image: ImageDocument): ImageSummaryDto {
    return {
      id: image._id.toString(),
      url: this.getPublicUrl(image.filename),
      alt: image.alt,
    };
  }

  private toResponse(image: ImageDocument): ImageResponseDto {
    return {
      ...this.toSummary(image),
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      uploadedBy: image.uploadedBy.toString(),
      createdAt: image.createdAt,
    };
  }
}
