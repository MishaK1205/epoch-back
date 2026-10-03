export interface CategoryUsageChecker {
  countArticles(categoryId: string): Promise<number>;
  countPublishedArticles(categoryIds: string[]): Promise<Map<string, number>>;
}
