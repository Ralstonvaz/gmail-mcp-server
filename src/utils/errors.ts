/**
 * Error handling utilities for Gmail MCP Server
 */

export class GmailMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'GmailMCPError';
  }
}

export class AuthenticationError extends GmailMCPError {
  constructor(message: string = 'Gmail authentication failed') {
    super(
      `${message}. Please check your GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env file.`,
      'AUTH_ERROR',
      401,
      false
    );
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends GmailMCPError {
  constructor(message: string = 'Gmail API rate limit exceeded') {
    super(
      `${message}. Please wait before retrying.`,
      'RATE_LIMIT_ERROR',
      429,
      true
    );
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends GmailMCPError {
  constructor(message: string, field?: string) {
    super(
      field ? `Validation error in ${field}: ${message}` : `Validation error: ${message}`,
      'VALIDATION_ERROR',
      400,
      false
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GmailMCPError {
  constructor(resource: string) {
    super(
      `${resource} not found`,
      'NOT_FOUND_ERROR',
      404,
      false
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Retry logic for API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof RateLimitError && attempt < maxRetries - 1) {
        const waitTime = delayMs * Math.pow(2, attempt); // Exponential backoff
        console.warn(`Rate limit hit, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (error instanceof GmailMCPError && !error.retryable) {
        throw error;
      }
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  
  throw lastError!;
}

