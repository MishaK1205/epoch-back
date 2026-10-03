import { randomBytes } from 'node:crypto';

const MAX_SLUG_LENGTH = 80;

/** Unicode-aware, so Georgian and other non-Latin titles produce readable slugs. */
export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}

export function withRandomSuffix(slug: string): string {
  return `${slug}-${randomBytes(3).toString('hex')}`;
}
