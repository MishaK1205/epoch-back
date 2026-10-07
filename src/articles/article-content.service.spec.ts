import { BadRequestException } from '@nestjs/common';
import { ImagesService } from '../images/images.service.js';
import { ArticleContentService } from './article-content.service.js';

describe('ArticleContentService', () => {
  const base = 'http://localhost:3000';
  const filename = '0b8f6c1e-4a52-4f0e-9a43-2a1f2b3c4d5e.jpg';
  const imagesService = {
    getPublicUrl: (name: string) => `${base}/uploads/${name}`,
    extractUploadFilename: (src: string) => {
      const match =
        /^(?:http:\/\/localhost:3000)?\/uploads\/([0-9a-f-]{36}\.jpg)$/.exec(
          src,
        );
      return match ? match[1] : null;
    },
  };
  const service = new ArticleContentService(
    imagesService as unknown as ImagesService,
  );

  it('removes scripts, event handlers and javascript: links', () => {
    const { html } = service.process(
      '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe>',
    );
    expect(html).toBe('<p>Hi</p><a>x</a>');
  });

  it('keeps Quill formatting and only safe styles', () => {
    const { html } = service.process(
      '<p class="ql-align-center evil" style="color: #ff0000; position: fixed">A</p><ol><li data-list="bullet">B</li></ol>',
    );
    expect(html).toBe(
      '<p class="ql-align-center" style="color:#ff0000">A</p><ol><li data-list="bullet">B</li></ol>',
    );
  });

  it('adds rel=noopener to links opening a new tab', () => {
    const { html } = service.process(
      '<p><a href="https://example.com" target="_blank">x</a></p>',
    );
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('rewrites uploaded image paths to absolute URLs and collects them', () => {
    const result = service.process(
      `<p>Text</p><p><img src="/uploads/${filename}" onerror="x()"></p>`,
    );
    expect(result.html).toBe(
      `<p>Text</p><p><img src="${base}/uploads/${filename}" /></p>`,
    );
    expect(result.imageFilenames).toEqual([filename]);
  });

  it.each([
    ['external', 'https://example.com/cat.jpg'],
    ['pasted base64', 'data:image/png;base64,iVBORw0KGgo='],
  ])('rejects %s images', (_label, src) => {
    expect(() => service.process(`<p><img src="${src}"></p>`)).toThrow(
      BadRequestException,
    );
  });

  it('builds plain text and an excerpt with block boundaries as spaces', () => {
    const result = service.process(
      `<h1>Title</h1><p>One &amp; two</p><p>${'word '.repeat(60)}</p>`,
    );
    expect(result.plainText.startsWith('Title One & two word')).toBe(true);
    expect(result.excerpt.length).toBeLessThanOrEqual(201);
    expect(result.excerpt.endsWith('…')).toBe(true);
  });

  it('rejects content that is empty after sanitizing', () => {
    expect(() => service.process('<script>x</script><p> </p>')).toThrow(
      new BadRequestException('Article content cannot be empty'),
    );
  });

  it('uses a custom message for empty content when given one', () => {
    expect(() =>
      service.process('<p> </p>', 'Question 2 cannot be empty'),
    ).toThrow(new BadRequestException('Question 2 cannot be empty'));
  });
});
