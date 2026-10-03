export interface ArticleDeletionListener {
  onArticleDeleted(articleId: string): Promise<void>;
}
