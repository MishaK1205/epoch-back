/** Minimal category info other modules need to validate and filter by category. */
export interface CategoryRef {
  id: string;
  /** Null for top-level categories. */
  parentId: string | null;
}
