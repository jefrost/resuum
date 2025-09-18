/**
 * AI Service (OpenAI Implementation)
 * Browser-compatible API service with provider abstraction
 * OPTIMIZED: Added timeouts and retry logic
 */

import { getSetting, setSetting } from '../storage/transactions';
import type { OpenAIEmbeddingResponse } from '../types';

// ============================================================================
// Provider Interface (for future abstraction)
// ============================================================================

export interface AIProvider {
  name: string;
  supportsBrowserFetch: boolean;
  supportsEmbeddings: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export enum OpenAIErrorCode {
  NO_KEY = 'ERR_NO_KEY',
  KEY_INVALID = 'ERR_KEY_INVALID',
  MODEL_UNAVAILABLE = 'ERR_MODEL_UNAVAILABLE',
  RATE_LIMIT = 'ERR_RATE_LIMIT',
  SERVER_ERROR = 'ERR_SERVER',
  UNSUPPORTED_FORMAT = 'ERR_UNSUPPORTED_FORMAT',
  PARSE_ERROR = 'ERR_PARSE',
  NETWORK_ERROR = 'ERR_NETWORK',
  TIMEOUT_ERROR = 'ERR_TIMEOUT'
}

export interface OpenAIError extends Error {
  code: OpenAIErrorCode;
  status?: number;
  retryAfter?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
const OPENAI_API_VERSION = '2024-02-15';
const DEFAULT_TIMEOUT_MS = 45000; // Increased to 45 seconds

// ============================================================================
// OpenAI Service Class
// ============================================================================

export class OpenAIService implements AIProvider {
  name = 'OpenAI';
  supportsBrowserFetch = true;
  supportsEmbeddings = true;
  
  private apiKey: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize service and load API key from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const storedKey = await getSetting('openai_api_key');
      if (storedKey && typeof storedKey === 'string') {
        this.apiKey = storedKey;
      }
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to load API key from storage:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Set API key and save to storage
   */
  async setApiKey(apiKey: string): Promise<void> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key provided');
    }

    // Validate OpenAI API key format
    if (!apiKey.startsWith('sk-')) {
      console.warn('API key does not start with "sk-" - may not be a standard OpenAI key');
    }

    this.apiKey = apiKey;
    
    try {
      await setSetting('openai_api_key', apiKey);
    } catch (error) {
      console.error('Failed to save API key to storage:', error);
    }
  }

  /**
   * Get current API key
   */
  getApiKey(): string {
    if (!this.apiKey) {
      throw this.createError(OpenAIErrorCode.NO_KEY, 'OpenAI API key not set');
    }
    return this.apiKey;
  }

  /**
   * Check if API key is set
   */
  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Clear API key from memory and storage
   */
  async clearApiKey(): Promise<void> {
    this.apiKey = null;
    
    try {
      await setSetting('openai_api_key', '');
    } catch (error) {
      console.error('Failed to clear API key from storage:', error);
    }
  }

  /**
   * Test API key validity
   */
  async testApiKey(model?: string): Promise<{ isValid: boolean; error?: string }> {
    if (!this.hasApiKey()) {
      return { isValid: false, error: 'No API key set' };
    }

    try {
      await this.createChatCompletion({
        model: model || DEFAULT_CHAT_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        temperature: 0
      });
      
      return { isValid: true };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const openAIError = error as OpenAIError;
        return { 
          isValid: false, 
          error: this.getErrorMessage(openAIError.code)
        };
      }
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create chat completion with OpenAI API - with timeout and retry
   */
  async createChatCompletion(params: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: any;
    timeoutMs?: number;
  }): Promise<any> {
    if (!this.hasApiKey()) {
      throw this.createError(OpenAIErrorCode.NO_KEY, 'OpenAI API key is required');
    }

    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const requestBody: any = {
      model: params.model || DEFAULT_CHAT_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 1000
    };

    // Add response format if supported
    if (params.response_format) {
      requestBody.response_format = params.response_format;
    }

    // Attempt 1: Normal request
    try {
      return await this.makeRequest(requestBody, timeoutMs);
    } catch (error) {
      const isTimeout = this.isTimeoutError(error);
      const isNetworkError = this.isNetworkError(error);
      
      if (!isTimeout && !isNetworkError) {
        throw error; // Re-throw API errors, auth errors, etc.
      }

      console.warn('OpenAI request failed, retrying with reduced tokens:', error);
      
      // Attempt 2: Retry with reduced max_tokens for faster response
      const retryBody = {
        ...requestBody,
        max_tokens: Math.max(200, Math.floor((requestBody.max_tokens ?? 1000) * 0.6))
      };
      
      const retryTimeout = Math.max(12000, Math.floor(timeoutMs * 0.6));
      
      try {
        return await this.makeRequest(retryBody, retryTimeout);
      } catch (retryError) {
        // If retry also fails, throw the original error
        throw error;
      }
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeRequest(requestBody: any, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.handleAPIError(response);
      }

      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError(OpenAIErrorCode.TIMEOUT_ERROR, 
          `Request timeout after ${timeoutMs}ms`);
      }
      
      if (error instanceof Error && 'code' in error) {
        throw error; // Already a formatted error
      }
      
      throw this.createError(OpenAIErrorCode.NETWORK_ERROR, 
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: any): boolean {
    if (error instanceof Error && 'code' in error) {
      return (error as OpenAIError).code === OpenAIErrorCode.TIMEOUT_ERROR;
    }
    
    const message = String(error?.message || '').toLowerCase();
    return message.includes('timeout') || message.includes('abort');
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (error instanceof Error && 'code' in error) {
      return (error as OpenAIError).code === OpenAIErrorCode.NETWORK_ERROR;
    }
    
    const message = String(error?.message || '').toLowerCase();
    return message.includes('network') || message.includes('fetch');
  }

  /**
   * Create embeddings
   */
  async createEmbeddings(
    input: string | string[],
    model: string = 'text-embedding-3-small'
  ): Promise<OpenAIEmbeddingResponse> {
    if (!this.hasApiKey()) {
      throw this.createError(OpenAIErrorCode.NO_KEY, 'OpenAI API key is required');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input,
        }),
      });

      if (!response.ok) {
        throw await this.handleAPIError(response);
      }

      return await response.json();
      
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(OpenAIErrorCode.NETWORK_ERROR, 
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle API errors
   */
  private async handleAPIError(response: Response): Promise<OpenAIError> {
    const retryAfter = response.headers.get('Retry-After');
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

    switch (response.status) {
      case 401:
      case 403:
        return this.createError(OpenAIErrorCode.KEY_INVALID, 'Invalid OpenAI API key', response.status);
      
      case 404:
        return this.createError(
          OpenAIErrorCode.MODEL_UNAVAILABLE,
          'Model not available for this key',
          response.status
        );
      
      case 429:
        return this.createError(
          OpenAIErrorCode.RATE_LIMIT, 
          'Rate limit exceeded. Please try again later.',
          response.status,
          retryAfter ? parseInt(retryAfter) : undefined
        );
      
      case 400:
        return this.createError(OpenAIErrorCode.PARSE_ERROR, errorMessage, response.status);
      
      case 500:
      case 502:
      case 503:
      case 504:
        return this.createError(OpenAIErrorCode.SERVER_ERROR, 
          'OpenAI server error. Please try again.', response.status);
      
      default:
        return this.createError(OpenAIErrorCode.NETWORK_ERROR, errorMessage, response.status);
    }
  }

  /**
   * Create normalized error
   */
  private createError(
    code: OpenAIErrorCode, 
    message: string, 
    status?: number, 
    retryAfter?: number
  ): OpenAIError {
    const error = new Error(message) as OpenAIError;
    error.code = code;
    if (status !== undefined) {
      error.status = status;
    }
    if (retryAfter !== undefined) {
      error.retryAfter = retryAfter;
    }
    return error;
  }

  /**
   * Get user-friendly error messages
   */
  private getErrorMessage(code: OpenAIErrorCode): string {
    switch (code) {
      case OpenAIErrorCode.NO_KEY:
        return 'Please set your OpenAI API key in settings';
      case OpenAIErrorCode.KEY_INVALID:
        return 'Invalid API key. Please check your OpenAI key in settings';
      case OpenAIErrorCode.MODEL_UNAVAILABLE:
        return 'Selected model isn\'t available for your account';
      case OpenAIErrorCode.RATE_LIMIT:
        return 'Rate limit exceeded. Please wait a moment and try again';
      case OpenAIErrorCode.SERVER_ERROR:
        return 'OpenAI server error. Please try again in a moment';
      case OpenAIErrorCode.UNSUPPORTED_FORMAT:
        return 'Feature not supported with current model';
      case OpenAIErrorCode.PARSE_ERROR:
        return 'Error processing response. Please try again';
      case OpenAIErrorCode.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again';
      case OpenAIErrorCode.TIMEOUT_ERROR:
        return 'Request timed out. Please try again';
      default:
        return 'Unknown error occurred';
    }
  }

  /**
   * Get usage info (placeholder)
   */
  async getUsageInfo(): Promise<{
    totalTokens: number;
    estimatedCost: number;
  }> {
    return {
      totalTokens: 0,
      estimatedCost: 0
    };
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalOpenAIService: OpenAIService | null = null;

/**
 * Get global OpenAI service instance
 */
export function getOpenAIService(): OpenAIService {
  if (!globalOpenAIService) {
    globalOpenAIService = new OpenAIService();
  }
  return globalOpenAIService;
}

/**
 * Initialize OpenAI service (explicit initialization)
 */
export async function initializeOpenAIService(): Promise<OpenAIService> {
  const service = getOpenAIService();
  await service.initialize();
  return service;
}