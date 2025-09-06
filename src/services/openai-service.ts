/**
 * OpenAI API service with rate limiting and error handling
 */

import type { OpenAIEmbeddingResponse } from '../types';

// ============================================================================
// Configuration Constants
// ============================================================================

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
  JITTER_MAX: 0.1, // 10% jitter
  CONCURRENT_LIMIT: 3 // Max concurrent requests
};

// ============================================================================
// OpenAI Service Class
// ============================================================================

export class OpenAIService {
  private apiKey: string | null = null;
  private currentRequests = 0;
  private requestQueue: Array<() => void> = [];

  /**
   * Set OpenAI API key (stored in memory only)
   */
  setApiKey(key: string): void {
    this.apiKey = key?.trim() || null;
  }

  /**
   * Get current API key status
   */
  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Clear stored API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.hasApiKey()) {
      return { success: false, error: 'No API key configured' };
    }

    try {
      // Use a minimal test request
      await this.generateEmbedding('test', { skipCache: true });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate embedding for text with caching and rate limiting
   */
  async generateEmbedding(
    text: string, 
    options: {
      model?: string;
      dimensions?: number;
      skipCache?: boolean;
    } = {}
  ): Promise<Float32Array> {
    if (!this.hasApiKey()) {
      throw new Error('OpenAI API key not configured');
    }

    const { model = DEFAULT_MODEL, dimensions = DEFAULT_DIMENSIONS } = options;
    
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Clean text for API
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Wait for rate limit slot
    await this.acquireRateLimit();

    try {
      const embedding = await this.makeEmbeddingRequest(cleanText, model, dimensions);
      return embedding;
    } finally {
      this.releaseRateLimit();
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateEmbeddings(texts: string[], options: {
    model?: string;
    dimensions?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    const { onProgress } = options;

    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.generateEmbedding(texts[i] || '', options);
      results.push(embedding);
      
      if (onProgress) {
        onProgress(i + 1, texts.length);
      }
    }

    return results;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Make the actual API request with retry logic
   */
  private async makeEmbeddingRequest(
    text: string, 
    model: string, 
    dimensions: number,
    retryCount = 0
  ): Promise<Float32Array> {
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model,
          dimensions
        }),
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.calculateBackoffDelay(retryCount);
        
        if (retryCount < RATE_LIMIT_CONFIG.MAX_RETRIES) {
          await this.sleep(delay);
          return this.makeEmbeddingRequest(text, model, dimensions, retryCount + 1);
        } else {
          throw new Error('Rate limit exceeded after maximum retries');
        }
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      // Parse response
      const data: OpenAIEmbeddingResponse = await response.json();
      
      // Validate response structure
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('Invalid embedding response format');
      }

      const embeddingData = data.data[0];
      if (!embeddingData?.embedding || !Array.isArray(embeddingData.embedding)) {
        throw new Error('Missing embedding data in response');
      }

      return new Float32Array(embeddingData.embedding);

    } catch (error) {
      // Retry on network errors
      if (retryCount < RATE_LIMIT_CONFIG.MAX_RETRIES && this.isRetryableError(error)) {
        const delay = this.calculateBackoffDelay(retryCount);
        await this.sleep(delay);
        return this.makeEmbeddingRequest(text, model, dimensions, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = RATE_LIMIT_CONFIG.BASE_DELAY * Math.pow(2, retryCount);
    const cappedDelay = Math.min(baseDelay, RATE_LIMIT_CONFIG.MAX_DELAY);
    const jitter = cappedDelay * RATE_LIMIT_CONFIG.JITTER_MAX * Math.random();
    return cappedDelay + jitter;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('fetch') ||
        message.includes('connection')
      );
    }
    return false;
  }

  /**
   * Acquire rate limit slot
   */
  private async acquireRateLimit(): Promise<void> {
    return new Promise(resolve => {
      if (this.currentRequests < RATE_LIMIT_CONFIG.CONCURRENT_LIMIT) {
        this.currentRequests++;
        resolve();
      } else {
        this.requestQueue.push(() => {
          this.currentRequests++;
          resolve();
        });
      }
    });
  }

  /**
   * Release rate limit slot
   */
  private releaseRateLimit(): void {
    this.currentRequests--;
    
    if (this.requestQueue.length > 0) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalOpenAIService: OpenAIService | null = null;

/**
 * Get global OpenAI service instance (singleton)
 */
export function getOpenAIService(): OpenAIService {
  if (!globalOpenAIService) {
    globalOpenAIService = new OpenAIService();
  }
  return globalOpenAIService;
}

/**
 * Reset service instance (for testing)
 */
export function resetOpenAIService(): void {
  globalOpenAIService = null;
}