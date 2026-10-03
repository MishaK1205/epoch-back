const MONGO_DUPLICATE_KEY = 11000;

export function isDuplicateKeyError(
  error: unknown,
): error is { code: number; keyPattern: Record<string, unknown> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === MONGO_DUPLICATE_KEY &&
    'keyPattern' in error &&
    typeof error.keyPattern === 'object' &&
    error.keyPattern !== null
  );
}
