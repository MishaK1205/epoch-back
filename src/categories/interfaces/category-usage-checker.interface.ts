export interface CategoryUsageChecker {
  /** Articles using the id as their category or as their subcategory. */
  countArticles(categoryId: string): Promise<number>;
  /**
   * Published articles per id. Top-level ids count by `category`, which already
   * includes articles in their subcategories; subcategory ids count by `subcategory`.
   */
  countPublishedArticles(categoryIds: string[]): Promise<Map<string, number>>;
}
