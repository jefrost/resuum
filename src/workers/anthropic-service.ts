/**
 * Anthropic API Service (renamed from OpenAI for Anthropic compatibility)
 * Handles API key management and Anthropic API calls with proper error handling
 */

import { getSetting, setSetting } from '../storage/transactions';
import type { OpenAIEmbeddingResponse } from '../types';

// ============================================================================
// Error Types for Normalized Error Handling
// ============================================================================

export enum OpenAIErrorCode {
  NO_KEY = 'ERR_NO_KEY',
  KEY_INVALID = 'ERR_KEY_INVALID',
  MODEL_UNAVAILABLE = 'ERR_MODEL_UNAVAILABLE',
  RATE_LIMIT = 'ERR_RATE_LIMIT',
  SERVER_ERROR = 'ERR_SERVER',
  UNSUPPORTED_FORMAT = 'ERR_UNSUPPORTED_FORMAT',
  PARSE_ERROR = 'ERR_PARSE',
  NETWORK_ERROR = 'ERR_NETWORK'
}

export interface OpenAIError extends Error {
  code: OpenAIErrorCode;
  status?: number;
  retryAfter?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CHAT_MODEL = 'claude-3-haiku-20240307'; // Fast and cost-effective
const ANTHROPIC_API_VERSION = '2023-06-01';

// ============================================================================
// Anthropic Service Class (keeping OpenAI name for compatibility)
// ============================================================================

export class OpenAIService {
  private apiKey: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize service and load API key from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const storedKey = await getSetting('openai_api_key'); // Keep same storage key
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

    // Validate Anthropic API key format
    if (!apiKey.startsWith('sk-ant-')) {
      console.warn('API key does not start with "sk-ant-" - may not be a standard Anthropic key');
    }

    this.apiKey = apiKey;
    
    try {
      await setSetting('openai_api_key', apiKey); // Keep same storage key
    } catch (error) {
      console.error('Failed to save API key to storage:', error);
      // Continue anyway - key is set in memory
    }
  }

  /**
   * Get current API key (throws if not set)
   */
  getApiKey(): string {
    if (!this.apiKey) {
      throw this.createError(OpenAIErrorCode.NO_KEY, 'Anthropic API key not set');
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
      await setSetting('openai_api_key', ''); // Keep same storage key
    } catch (error) {
      console.error('Failed to clear API key from storage:', error);
    }
  }

  /**
   * Test API key validity with configurable model
   */
  async testApiKey(model?: string): Promise<{ isValid: boolean; error?: string }> {
    if (!this.hasApiKey()) {
      return { isValid: false, error: 'No API key set' };
    }

    const originalKey = this.apiKey; // Store original key

    try {
      // Use configurable model for testing
      await this.createChatCompletion({
        model: model || DEFAULT_CHAT_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        temperature: 0
      });
      
      return { isValid: true };
    } catch (error) {
      // Don't clear the key in memory on test failure
      this.apiKey = originalKey;
      
      if (error instanceof Error && 'code' in error) {
        const anthropicError = error as OpenAIError;
        return { 
          isValid: false, 
          error: this.getErrorMessage(anthropicError.code)
        };
      }
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Create chat completion with Anthropic API
   */
  async createChatCompletion(params: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: any; // Ignored for Anthropic
  }): Promise<any> {
    if (!this.hasApiKey()) {
      throw this.createError(OpenAIErrorCode.NO_KEY, 'Anthropic API key is required');
    }

    // Convert OpenAI-style messages to Anthropic format
    const systemMessage = params.messages.find(m => m.role === 'system');
    const userMessages = params.messages.filter(m => m.role === 'user' || m.role === 'assistant');

    const requestBody: any = {
      model: params.model || DEFAULT_CHAT_MODEL,
      max_tokens: params.max_tokens ?? 1000,
      temperature: params.temperature ?? 0.7,
      messages: userMessages
    };

    // Add system message if present
    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw await this.handleAPIError(response);
      }

      const data = await response.json();
      
      // Convert Anthropic response to OpenAI format for compatibility
      return {
        choices: [{
          message: {
            content: data.content?.[0]?.text || ''
          }
        }]
      };
      
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Already normalized
      }
      throw this.createError(OpenAIErrorCode.NETWORK_ERROR, 
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create embeddings - Not supported by Anthropic, throw helpful error
   */
  async createEmbeddings(
    input: string | string[],
    model: string = 'text-embedding-3-small'
  ): Promise<OpenAIEmbeddingResponse> {
    throw this.createError(
      OpenAIErrorCode.UNSUPPORTED_FORMAT, 
      'Embeddings not supported with Anthropic API. Consider using a hybrid approach with OpenAI for embeddings.'
    );
  }

  /**
   * Handle API errors and normalize to internal error codes
   */
  private async handleAPIError(response: Response): Promise<OpenAIError> {
    const retryAfter = response.headers.get('Retry-After');
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors for error responses
    }

    const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`;

    switch (response.status) {
      case 401:
      case 403:
        return this.createError(OpenAIErrorCode.KEY_INVALID, 'Invalid Anthropic API key', response.status);
      
      case 404:
        return this.createError(
          OpenAIErrorCode.MODEL_UNAVAILABLE,
          'Model not available for this key or region',
          response.status
        );
      
      case 429:
        return this.createError(
          OpenAIErrorCode.RATE_LIMIT, 
          'Rate limit exceeded. Please try again later.',
          response.status,
          retryAfter ? parseInt(retryAfter) : undefined
        );
      
      case 400: {
        const lowerMessage = errorMessage.toLowerCase();
        
        if (lowerMessage.includes('max_tokens') || lowerMessage.includes('too many tokens')) {
          return this.createError(OpenAIErrorCode.PARSE_ERROR, 
            'Input too long for the selected model', response.status);
        }
        
        return this.createError(OpenAIErrorCode.PARSE_ERROR, errorMessage, response.status);
      }
      
      case 500:
      case 502:
      case 503:
      case 504:
        return this.createError(OpenAIErrorCode.SERVER_ERROR, 
          'Anthropic server error. Please try again.', response.status);
      
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
        return 'Please set your Anthropic API key in settings';
      case OpenAIErrorCode.KEY_INVALID:
        return 'Invalid API key. Please check your Anthropic key in settings';
      case OpenAIErrorCode.MODEL_UNAVAILABLE:
        return 'Selected model isn\'t available for your account. Choose a different model in Settings.';
      case OpenAIErrorCode.RATE_LIMIT:
        return 'Rate limit exceeded. Please wait a moment and try again';
      case OpenAIErrorCode.SERVER_ERROR:
        return 'Anthropic server error. Please try again in a moment';
      case OpenAIErrorCode.UNSUPPORTED_FORMAT:
        return 'Feature not supported with Anthropic API';
      case OpenAIErrorCode.PARSE_ERROR:
        return 'Error processing response. Please try again';
      case OpenAIErrorCode.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again';
      default:
        return 'Unknown error occurred';
    }
  }

  /**
   * Get usage info (placeholder for future implementation)
   */
  async getUsageInfo(): Promise<{
    totalTokens: number;
    estimatedCost: number;
  }> {
    // TODO: Implement usage tracking for Anthropic
    return {
      totalTokens: 0,
      estimatedCost: 0
    };
  }
}

// ============================================================================
// Global Service Instance (keeping OpenAI names for compatibility)
// ============================================================================

let globalOpenAIService: OpenAIService | null = null;

/**
 * Get global service instance
 */
export function getOpenAIService(): OpenAIService {
  if (!globalOpenAIService) {
    globalOpenAIService = new OpenAIService();
  }
  return globalOpenAIService;
}

/**
 * Initialize service (explicit initialization)
 */
export async function initializeOpenAIService(): Promise<OpenAIService> {
  const service = getOpenAIService();
  await service.initialize();
  return service;
}