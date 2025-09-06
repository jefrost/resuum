/**
 * Job description analysis service
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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Job Analyzer Class
// ============================================================================

export class JobAnalyzer {
  /**
   * Analyze job description and generate embedding
   */
  async analyzeJob(
    title: string,
    description: string,
    options: {
      enableDeepAnalysis?: boolean;
      functionBias?: string;
    } = {}
  ): Promise<JobAnalysis> {
    // Check cache first
    const cached = this.getCachedAnalysis(description);
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
      // Generate embedding for job description
      const combinedText = `${title}\n\n${description}`;
      const embedding = await openaiService.generateEmbedding(combinedText);
      
      // Create basic analysis
      const analysis: JobAnalysis = {
        title: title.trim(),
        description: description.trim(),
        embedding,
        ...(options.functionBias && { functionBias: options.functionBias })
      };
      
      // Add deep analysis if enabled
      if (options.enableDeepAnalysis) {
        const deepAnalysis = await this.performDeepAnalysis(title, description);
        analysis.skills = deepAnalysis.skills;
        analysis.requirements = deepAnalysis.requirements;
      }
      
      // Cache the result
      this.cacheAnalysis(description, analysis);
      
      return analysis;
      
    } catch (error) {
      throw new Error(`Job analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Perform deep analysis of job description (optional)
   */
  private async performDeepAnalysis(title: string, description: string): Promise<{
    skills: string[];
    requirements: string[];
  }> {
    // For MVP, use simple keyword extraction
    // In future versions, this could use GPT for more sophisticated analysis
    
    const skills = this.extractSkills(description);
    const requirements = this.extractRequirements(description);
    
    return { skills, requirements };
  }
  
  /**
   * Extract skills from job description using keyword matching
   */
  private extractSkills(description: string): string[] {
    const skillKeywords = [
      // Technical skills
      'python', 'javascript', 'react', 'sql', 'aws', 'kubernetes', 'docker',
      'machine learning', 'data analysis', 'statistics', 'modeling',
      
      // Business skills
      'strategy', 'consulting', 'project management', 'leadership', 'communication',
      'analysis', 'operations', 'marketing', 'sales', 'finance',
      
      // Soft skills
      'collaboration', 'problem solving', 'critical thinking', 'presentation',
      'negotiation', 'mentoring', 'training'
    ];
    
    const text = description.toLowerCase();
    const foundSkills: string[] = [];
    
    for (const skill of skillKeywords) {
      if (text.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    }
    
    return foundSkills.slice(0, 10); // Limit to top 10
  }
  
  /**
   * Extract requirements from job description
   */
  private extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    
    // Look for degree requirements
    if (/bachelor|ba\b|bs\b/i.test(description)) {
      requirements.push("Bachelor's degree");
    }
    if (/master|mba|ms\b/i.test(description)) {
      requirements.push("Master's degree");
    }
    
    // Look for experience requirements
    const expMatch = description.match(/(\d+)\+?\s*years?\s*(?:of\s*)?experience/i);
    if (expMatch) {
      requirements.push(`${expMatch[1]}+ years experience`);
    }
    
    // Look for specific certifications or tools
    if (/certification|certified/i.test(description)) {
      requirements.push('Professional certification');
    }
    
    return requirements;
  }
  
  /**
   * Get cached analysis if still valid
   */
  private getCachedAnalysis(description: string): JobAnalysis | null {
    if (!analysisCache) {
      return null;
    }
    
    const now = Date.now();
    const isExpired = (now - analysisCache.timestamp) > CACHE_DURATION;
    const isSameJob = analysisCache.jobDescription === description;
    
    if (isExpired || !isSameJob) {
      analysisCache = null;
      return null;
    }
    
    return analysisCache.analysis;
  }
  
  /**
   * Cache analysis result
   */
  private cacheAnalysis(description: string, analysis: JobAnalysis): void {
    analysisCache = {
      jobDescription: description,
      analysis: { ...analysis }, // Clone to avoid mutations
      timestamp: Date.now()
    };
  }
  
  /**
   * Clear analysis cache
   */
  clearCache(): void {
    analysisCache = null;
  }
}

// ============================================================================
// Global Analyzer Instance
// ============================================================================

let globalAnalyzer: JobAnalyzer | null = null;

/**
 * Get global job analyzer (singleton)
 */
export function getJobAnalyzer(): JobAnalyzer {
  if (!globalAnalyzer) {
    globalAnalyzer = new JobAnalyzer();
  }
  return globalAnalyzer;
}

/**
 * Reset analyzer instance (for testing)
 */
export function resetJobAnalyzer(): void {
  globalAnalyzer = null;
  analysisCache = null;
}