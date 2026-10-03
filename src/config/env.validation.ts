export interface EnvironmentVariables {
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: number;
  ADMIN_USERNAME: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  UPLOAD_DIR: string;
  MAX_UPLOAD_SIZE_MB: number;
  PUBLIC_BASE_URL: string;
}

const MIN_JWT_SECRET_LENGTH = 32;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const errors: string[] = [];

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    errors.push('PORT must be a positive integer');
  }

  const mongoUri = config.MONGODB_URI;
  if (!isNonEmptyString(mongoUri)) {
    errors.push('MONGODB_URI is required');
  }

  const jwtSecret = config.JWT_SECRET;
  if (
    typeof jwtSecret !== 'string' ||
    jwtSecret.length < MIN_JWT_SECRET_LENGTH
  ) {
    errors.push(
      `JWT_SECRET is required and must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }

  const jwtExpiresIn = Number(config.JWT_EXPIRES_IN ?? 3600);
  if (!Number.isInteger(jwtExpiresIn) || jwtExpiresIn <= 0) {
    errors.push('JWT_EXPIRES_IN must be a positive integer (seconds)');
  }

  const adminUsername = config.ADMIN_USERNAME;
  if (
    !isNonEmptyString(adminUsername) ||
    !/^[a-zA-Z0-9_.]{3,30}$/.test(adminUsername.trim())
  ) {
    errors.push(
      'ADMIN_USERNAME is required (3-30 letters, numbers, underscores or dots)',
    );
  }

  const adminEmail = config.ADMIN_EMAIL;
  if (!isNonEmptyString(adminEmail) || !adminEmail.includes('@')) {
    errors.push('ADMIN_EMAIL is required and must be an email address');
  }

  const adminPassword = config.ADMIN_PASSWORD;
  if (
    typeof adminPassword !== 'string' ||
    adminPassword.length < 8 ||
    adminPassword.length > 72
  ) {
    errors.push('ADMIN_PASSWORD is required and must be 8-72 characters');
  }

  const uploadDir = config.UPLOAD_DIR ?? 'uploads';
  if (!isNonEmptyString(uploadDir)) {
    errors.push('UPLOAD_DIR must be a non-empty path');
  }

  const maxUploadSizeMb = Number(config.MAX_UPLOAD_SIZE_MB ?? 5);
  if (!Number.isFinite(maxUploadSizeMb) || maxUploadSizeMb <= 0) {
    errors.push('MAX_UPLOAD_SIZE_MB must be a positive number');
  }

  const publicBaseUrl = config.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  if (
    !isNonEmptyString(publicBaseUrl) ||
    !/^https?:\/\/[^/\s]+/.test(publicBaseUrl)
  ) {
    errors.push(
      'PUBLIC_BASE_URL must be an http(s) URL, e.g. http://localhost:3000',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    PORT: port,
    MONGODB_URI: mongoUri as string,
    JWT_SECRET: jwtSecret as string,
    JWT_EXPIRES_IN: jwtExpiresIn,
    ADMIN_USERNAME: adminUsername as string,
    ADMIN_EMAIL: adminEmail as string,
    ADMIN_PASSWORD: adminPassword as string,
    UPLOAD_DIR: uploadDir as string,
    MAX_UPLOAD_SIZE_MB: maxUploadSizeMb,
    PUBLIC_BASE_URL: (publicBaseUrl as string).replace(/\/+$/, ''),
  };
}
