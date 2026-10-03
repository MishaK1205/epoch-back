export interface ImageUsageChecker {
  isImageInUse(imageId: string): Promise<boolean>;
}
