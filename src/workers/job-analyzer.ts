/**
 * AI-Powered Job Analysis Service
 * Extracts skills, requirements, and context from job descriptions
 */

import { getOpenAIService } from './openai-service';
import type { JobAnalysis } from '../types';

// ============================================================================
// Job Analysis Cache
// ============================================================================

interface CachedAnalysis {
  cacheKey: string;
  analysis: JobAnalysis;
  timestamp: number;
}

let analysisCache: CachedAnalysis | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const MAX_INPUT_LENGTH = 8000; // Context length safety

// ============================================================================
// JSON Schema for Structured Output
// ============================================================================

const JOB_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    extractedSkills: {
      type: "array",
      items: { type: "string" },
      description: "8-12 key skills mentioned or implied in the job posting"
    },
    keyRequirements: {
      type: "array", 
      items: { type: "string" },
      description: "5-8 essential requirements for the role"
    },
    roleLevel: {
      type: "string",
      enum: ["entry", "mid", "senior", "executive"],
      description: "Experience level based on title and requirements"
    },
    functionType: {
      type: "string",
      description: "Primary function area (e.g., Product Management, Strategy, Engineering)"
    },
    companyContext: {
      type: "string",
      description: "Brief description of company/industry context if mentioned"
    }
  },
  required: ["extractedSkills", "keyRequirements", "roleLevel", "functionType"],
  additionalProperties: false
};

// ============================================================================
// Job Analyzer Class
// ============================================================================

export class JobAnalyzer {
  /**
   * Analyze job description using AI to extract skills and requirements
   */
  async analyzeJob(
    title: string,
    description: string
  ): Promise<JobAnalysis> {
    // Check cache first
    const cacheKey = `${title}|${description}`;
    const cached = this.getCachedAnalysis(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Validate inputs
    if (!title.trim() || !description.trim()) {
      throw new Error('Job title and description are required');
    }
    
    const openaiService = getOpenAIService();
    if (!openaiService.hasApiKey()) {
      throw new Error('OpenAI API key is required for job analysis');
    }
    
    try {
      const analysis = await this.performAIAnalysis(title, description);
      
      // Cache the result
      this.cacheAnalysis(cacheKey, analysis);
      
      return analysis;
      
    } catch (error) {
      throw new Error(`Job analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform AI-powered analysis with structured output
   */
  private async performAIAnalysis(title: string, description: string): Promise<JobAnalysis> {
    const openaiService = getOpenAIService();
    
    // Truncate description if too long to prevent context overflow
    const truncatedDescription = description.length > MAX_INPUT_LENGTH 
      ? description.substring(0, MAX_INPUT_LENGTH) + '...'
      : description;
    
    const prompt = `Analyze this job posting and extract structured information:

JOB TITLE: ${title}

JOB DESCRIPTION:
${truncatedDescription}

Extract key skills, requirements, role level, function type, and company context. Focus on:
- Technical and soft skills that would be valuable
- Experience requirements and qualifications  
- Responsibilities that indicate required capabilities
- Leadership, analytical, communication, and domain-specific skills
- Consider the role title context when interpreting requirements`;

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiService.getApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You must return JSON matching the provided schema. No extra text.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0, // Deterministic for extraction
            max_tokens: 800,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "JobAnalysis",
                strict: true,
                schema: JOB_ANALYSIS_SCHEMA
              }
            }
          })
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait and retry
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
            await this.sleep(waitTime);
            continue;
          } else if (response.status >= 500) {
            // Server error - retry with backoff
            if (attempt < maxRetries) {
              await this.sleep(Math.pow(2, attempt) * 1000);
              continue;
            }
          }
          
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('No analysis content received from OpenAI');
        }

        // Parse JSON response
        const analysisData = JSON.parse(content);
        
        // Validate required fields exist
        if (!analysisData.extractedSkills || !analysisData.keyRequirements || !analysisData.roleLevel) {
          throw new Error('Invalid response structure from AI');
        }
        
        // Construct full analysis object
        const analysis: JobAnalysis = {
          title: title.trim(),
          description: description.trim(),
          extractedSkills: analysisData.extractedSkills || [],
          keyRequirements: analysisData.keyRequirements || [],
          roleLevel: analysisData.roleLevel || 'mid',
          functionType: analysisData.functionType || 'General',
          companyContext: analysisData.companyContext || undefined
        };

        return analysis;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (error instanceof SyntaxError && attempt < maxRetries) {
          // JSON parse failed - retry once with previous output quoted
          await this.sleep(1000);
          continue;
        }
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        
        throw lastError;
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('connection') ||
           message.includes('5');
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cached analysis if still valid
   */
  private getCachedAnalysis(cacheKey: string): JobAnalysis | null {
    if (!analysisCache) return null;
    
    const isExpired = Date.now() - analysisCache.timestamp > CACHE_DURATION;
    if (isExpired) {
      analysisCache = null;
      return null;
    }
    
    if (analysisCache.cacheKey === cacheKey) {
      return analysisCache.analysis;
    }
    
    return null;
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(cacheKey: string, analysis: JobAnalysis): void {
    analysisCache = {
      cacheKey,
      analysis,
      timestamp: Date.now()
    };
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalJobAnalyzer: JobAnalyzer | null = null;

/**
 * Get global JobAnalyzer instance (singleton)
 */
export function getJobAnalyzer(): JobAnalyzer {
  if (!globalJobAnalyzer) {
    globalJobAnalyzer = new JobAnalyzer();
  }
  return globalJobAnalyzer;
}