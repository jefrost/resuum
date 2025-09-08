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
  jobDescription: string;
  analysis: JobAnalysis;
  timestamp: number;
}

let analysisCache: CachedAnalysis | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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
   * Perform AI-powered analysis of job description
   */
  private async performAIAnalysis(title: string, description: string): Promise<JobAnalysis> {
    const openaiService = getOpenAIService();
    
    const prompt = `Analyze this job posting and extract structured information:

JOB TITLE: ${title}

JOB DESCRIPTION:
${description}

Please analyze this job posting and return a JSON response with the following structure:
{
  "extractedSkills": ["skill1", "skill2", ...], // 8-12 key skills mentioned or implied
  "keyRequirements": ["requirement1", "requirement2", ...], // 5-8 essential requirements
  "roleLevel": "entry|mid|senior|executive", // Based on title and requirements
  "functionType": "string", // Primary function (e.g., "Product Management", "Strategy", "Engineering")
  "companyContext": "string" // Brief description of company/industry context if mentioned
}

Focus on:
- Technical and soft skills that would be valuable
- Experience requirements and qualifications
- Responsibilities that indicate required capabilities
- Leadership, analytical, communication, and domain-specific skills
- Consider the role title context when interpreting requirements

Return only valid JSON, no other text.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiService['apiKey']}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent extraction
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No analysis content received from OpenAI');
      }

      // Parse JSON response
      const analysisData = JSON.parse(content);
      
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
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI analysis response');
      }
      throw error;
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
    
    // Simple cache key matching (in production, might want more sophisticated caching)
    if (analysisCache.jobDescription === cacheKey) {
      return analysisCache.analysis;
    }
    
    return null;
  }

  /**
   * Cache analysis result
   */
  private cacheAnalysis(cacheKey: string, analysis: JobAnalysis): void {
    analysisCache = {
      jobDescription: cacheKey,
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