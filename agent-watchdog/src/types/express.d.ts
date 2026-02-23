declare namespace Express {
  interface Request {
    authApiKeyId?: string;
    authApiKeyPreview?: string;
  }
}
