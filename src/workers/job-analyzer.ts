/**
 * AI-Powered Job Analysis Service
 * Extracts skills, requirements, and context from job descriptions using OpenAI
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
const MODEL = 'gpt-4o-mini';
const PROMPT_VERSION = 'v4'; // Updated for OpenAI

// ============================================================================
// Job Analyzer Class
// ============================================================================

export class JobAnalyzer {
  /**
   * Analyze job description using OpenAI to extract skills and requirements
   */
  async analyzeJob(
    title: string,
    description: string
  ): Promise<JobAnalysis> {
    // Truncate description for caching and API calls
    const truncatedDescription = this.truncateDescription(description);
    
    // Check cache first (include model and prompt version)
    const cacheKey = `${MODEL}|${PROMPT_VERSION}|${title.trim()}|${truncatedDescription}`;
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
      const analysis = await this.performAIAnalysis(title, truncatedDescription);
      
      // Cache the result
      this.cacheAnalysis(cacheKey, analysis);
      
      return analysis;
      
    } catch (error) {
      // Preserve structured error codes
      if (error && typeof (error as any).code === 'string') {
        throw error;
      }
      const wrappedError = new Error(`Job analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      (wrappedError as any).code = 'ERR_ANALYZER';
      throw wrappedError;
    }
  }

  /**
   * Truncate description with section-aware logic
   */
  private truncateDescription(description: string): string {
    if (description.length <= MAX_INPUT_LENGTH) {
      return description;
    }

    const sections = ['requirements', 'qualifications', 'responsibilities', 'skills', 'experience'];
    const sectionRegex = new RegExp(`(${sections.join('|')})`, 'gi');

    const firstSectionIndex = description.search(sectionRegex);
    if (firstSectionIndex >= 0) {
      const fromFirstSection = description.substring(firstSectionIndex);
      if (fromFirstSection.length <= MAX_INPUT_LENGTH) {
        return fromFirstSection;
      }
      return fromFirstSection.substring(0, MAX_INPUT_LENGTH) + '...';
    }

    return description.substring(0, MAX_INPUT_LENGTH) + '...';
  }

  /**
   * Perform AI-powered analysis with OpenAI (simple JSON format)
   */
  private async performAIAnalysis(title: string, truncatedDescription: string): Promise<JobAnalysis> {
    const openaiService = getOpenAIService();
    
    const prompt = `Analyze this job posting and extract structured information. Return ONLY valid JSON with no other text.

JOB TITLE: ${title}

JOB DESCRIPTION:
${truncatedDescription}

Return a JSON object with exactly these fields:
{
  "extractedSkills": ["skill1", "skill2", ...],
  "keyRequirements": ["requirement1", "requirement2", ...],
  "roleLevel": "entry|mid|senior|executive",
  "functionType": "string",
  "companyContext": "string"
}

Focus on:
- 8-12 key skills mentioned or implied
- 5-8 essential requirements for the role
- Experience level based on title and requirements
- Primary function area (e.g., "Product Management", "Strategy", "Engineering")
- Brief company/industry context if mentioned

Return ONLY the JSON object, no explanations or additional text.`;

    try {
      const response = await openaiService.createChatCompletion({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No analysis content received from OpenAI');
      }

      // Parse JSON response with fallback handling
      const analysisData = this.parseJSONResponse(content);
      
      // Validate required fields exist
      if (!analysisData.extractedSkills || !analysisData.keyRequirements || !analysisData.roleLevel) {
        throw new Error('Invalid response structure from AI');
      }
      
      // Construct full analysis object
      const analysis: JobAnalysis = {
        title: title.trim(),
        description: truncatedDescription.trim(),
        extractedSkills: analysisData.extractedSkills || [],
        keyRequirements: analysisData.keyRequirements || [],
        roleLevel: analysisData.roleLevel || 'mid',
        functionType: analysisData.functionType || 'General',
        companyContext: analysisData.companyContext || undefined
      };

      return analysis;
        
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse JSON response with fallback handling
   */
  private parseJSONResponse(content: string): any {
    // Try direct JSON parse first
    try {
      return JSON.parse(content);
    } catch (e) {
      // Fallback: Look for JSON in response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // If all else fails, throw original error
          throw new SyntaxError('Could not parse JSON from response');
        }
      }
      throw new SyntaxError('No JSON found in response');
    }
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