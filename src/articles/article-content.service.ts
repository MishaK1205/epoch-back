import { BadRequestException, Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { ImagesService } from '../images/images.service.js';

const EXCERPT_LENGTH = 200;

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i];

export interface ProcessedContent {
  html: string;
  plainText: string;
  excerpt: string;
  imageFilenames: string[];
}

/** Sanitizes Quill HTML (articles, quiz questions) so it is safe to render as-is. */
@Injectable()
export class ArticleContentService {
  constructor(private readonly imagesService: ImagesService) {}

  process(
    rawHtml: string,
    emptyMessage = 'Article content cannot be empty',
  ): ProcessedContent {
    const imageFilenames = new Set<string>();
    const rejectedImages: string[] = [];

    const html = sanitizeHtml(rawHtml, {
      allowedTags: [
        'p',
        'br',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'sub',
        'sup',
        'blockquote',
        'pre',
        'code',
        'ol',
        'ul',
        'li',
        'a',
        'img',
        'span',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
        li: ['data-list'],
        pre: ['data-language', 'spellcheck'],
        '*': ['class', 'style'],
      },
      allowedClasses: { '*': [/^ql-[\w-]+$/] },
      allowedStyles: {
        '*': {
          color: COLOR,
          'background-color': COLOR,
          'text-align': [/^(left|right|center|justify)$/],
        },
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      allowProtocolRelative: false,
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs:
            attribs.target === '_blank'
              ? { ...attribs, rel: 'noopener noreferrer' }
              : attribs,
        }),
        img: (tagName, attribs) => {
          const filename = this.imagesService.extractUploadFilename(
            attribs.src ?? '',
          );
          if (!filename) {
            rejectedImages.push(attribs.src ?? '');
            return { tagName, attribs: {} };
          }
          imageFilenames.add(filename);
          return {
            tagName,
            attribs: {
              ...attribs,
              src: this.imagesService.getPublicUrl(filename),
            },
          };
        },
      },
    });

    if (rejectedImages.length > 0) {
      throw new BadRequestException(
        'Images in content must be uploaded via POST /images first (pasted or external images are not allowed)',
      );
    }

    const plainText = toPlainText(html);
    if (!plainText && imageFilenames.size === 0) {
      throw new BadRequestException(emptyMessage);
    }

    return {
      html,
      plainText,
      excerpt: buildExcerpt(plainText),
      imageFilenames: [...imageFilenames],
    };
  }
}

function toPlainText(html: string): string {
  // Block boundaries become spaces so "<p>a</p><p>b</p>" reads "a b", not "ab".
  const spaced = html.replace(
    /<\/(p|h[1-6]|li|blockquote|pre)>|<br\s*\/?>/gi,
    ' ',
  );
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&');
}

function buildExcerpt(plainText: string): string {
  if (plainText.length <= EXCERPT_LENGTH) {
    return plainText;
  }
  const cut = plainText.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
