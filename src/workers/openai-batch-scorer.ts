/**
 * OpenAI Batch Scorer
 * Handles OpenAI API calls for bullet scoring with OpenAI-specific patterns
 * OPTIMIZED: Added concurrency, prompt trimming, and output token capping
 */

import { getOpenAIService } from './openai-service';
import type { JobAnalysis } from '../types';
import type { ScoredBullet } from './openai-ranking-engine';

// ============================================================================
// Configuration - OpenAI optimized with performance improvements
// ============================================================================

const MAX_TOKENS_PER_BATCH = 2500; // Reduced from 4000
const MIN_BATCH_SIZE = 8;
const MAX_BATCH_SIZE = 12; // Reduced from 20 for better latency
const TOKENS_PER_CHAR = 0.25; // Slightly leaner estimate
const CONCURRENCY = 2; // Reduced to avoid rate limits
const MAX_JD_CHARS = 800; // Trim job description to reduce tokens

// ============================================================================
// Types - EXPORTED FOR USE IN OTHER FILES
// ============================================================================

export interface OpenAIBatchRequest {
    jobTitle: string;
    jobDescription: string;
    skills: string[];
    bullets: Array<{ id: string; text: string }>;
    originalBullets: ScoredBullet[];
}

export interface OpenAIBatchResponse {
  bullets: Array<{
    id: string;
    score: number;
    reasoning: string;
    skill_matches: string[];
    quality_flags: string[];
  }>;
}

// ============================================================================
// OpenAI Batch Scorer - EXPORTED CLASS
// ============================================================================

export class OpenAIBatchScorer {
  
  /**
   * Score bullets using OpenAI in batches with concurrency
   */
  async scoreBullets(
    jobAnalysis: JobAnalysis,
    bullets: ScoredBullet[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<ScoredBullet[]> {
    const openaiService = getOpenAIService();
    
    if (!openaiService.hasApiKey()) {
      throw new Error('OpenAI API key required for scoring');
    }

    const batches = this.createBatches(jobAnalysis, bullets);
    
    if (batches.length === 0) {
      throw new Error('No batches created - insufficient bullet data');
    }
    
    const allScored: ScoredBullet[] = [];
    let next = 0;
    let completed = 0;

    // Concurrent worker function with rate limiting
    const worker = async () => {
      while (true) {
        const idx = next++;
        if (idx >= batches.length) break;
        
        const batch = batches[idx];
        if (!batch) {
          console.warn(`Batch ${idx} is undefined, skipping`);
          continue;
        }
        
        // Add delay between requests to avoid rate limiting
        if (idx > 0) {
          await this.sleep(2000); // 2 second delay between batches
        }
        
        try {
          const scored = await this.scoreBatch(batch, openaiService);
          allScored.push(...scored);
        } catch (error) {
          console.warn(`OpenAI batch ${idx + 1} failed, retrying:`, error);
          // Single retry with longer delay
          await this.sleep(5000);
          try {
            const scored = await this.scoreBatch(batch, openaiService);
            allScored.push(...scored);
          } catch (retryError) {
            console.error(`OpenAI batch ${idx + 1} failed after retry:`, retryError);
            throw new Error(`OpenAI batch scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } finally {
          completed++;
          // Progress between 0.4 and 0.8
          const progress = 0.4 + (completed / batches.length) * 0.4;
          onProgress?.(`OpenAI scoring (batch ${completed}/${batches.length})...`, progress);
        }
      }
    };

    // Run workers concurrently
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, batches.length) },
      () => worker()
    );
    
    await Promise.all(workers);

    return this.normalizeScores(allScored, jobAnalysis.extractedSkills);
  }

  /**
   * Create batches optimized for OpenAI with smaller sizes
   */
  private createBatches(jobAnalysis: JobAnalysis, bullets: ScoredBullet[]): OpenAIBatchRequest[] {
    const baseTokens = this.estimateBaseTokens(jobAnalysis);
    const batches: OpenAIBatchRequest[] = [];
    
    let currentBatch: ScoredBullet[] = [];
    let currentTokens = baseTokens;

    for (const bullet of bullets) {
      const bulletTokens = bullet.text.length * TOKENS_PER_CHAR + 50; // Reduced overhead
      
      if (currentBatch.length >= MIN_BATCH_SIZE && 
          (currentTokens + bulletTokens > MAX_TOKENS_PER_BATCH || 
           currentBatch.length >= MAX_BATCH_SIZE)) {
        
        batches.push(this.createBatchRequest(jobAnalysis, currentBatch));
        currentBatch = [bullet];
        currentTokens = baseTokens + bulletTokens;
      } else {
        currentBatch.push(bullet);
        currentTokens += bulletTokens;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(this.createBatchRequest(jobAnalysis, currentBatch));
    }

    return batches;
  }

  /**
   * Score a single batch with OpenAI - optimized prompts
   */
  private async scoreBatch(
    batch: OpenAIBatchRequest,
    openaiService: any
  ): Promise<ScoredBullet[]> {
    
    // Trim job description to reduce tokens
    const trimmedDescription = batch.jobDescription.substring(0, MAX_JD_CHARS);
    
    // OpenAI-optimized system prompt - simplified for better JSON output
    const systemPrompt = `You are a resume scoring assistant. For each bullet point, return a score from 1.0 to 10.0 based on relevance to the job.

STRICT JSON FORMAT REQUIRED - no markdown, no extra text:
{
  "bullets": [
    {"id": "bullet_id", "score": 7.5, "reasoning": "brief reason", "skill_matches": ["skill1"], "quality_flags": ["quantified"]}
  ]
}`;

    // Simplified user prompt to reduce JSON parsing errors
    const userPrompt = `JOB: ${batch.jobTitle}
SKILLS: ${batch.skills.slice(0, 8).join(', ')}

DESCRIPTION: ${trimmedDescription}

RATE THESE BULLETS (return exact JSON format):
${batch.bullets.map((b, i) => `${i + 1}. ID: ${b.id}\n   ${b.text.substring(0, 150)}...`).join('\n\n')}

Return JSON with ${batch.bullets.length} items using exact IDs provided.`;

    // More conservative token cap to improve JSON reliability
    const maxTokens = Math.min(400, 50 + batch.bullets.length * 18);

    const response = await openaiService.createChatCompletion({
      model: 'gpt-4o-mini', // OpenAI model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent scoring
      max_tokens: maxTokens, // Dynamic cap
      response_format: { type: "json_object" }, // OpenAI JSON mode
      timeoutMs: 25000 // 25 second timeout
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = this.parseOpenAIResponse(content, batch.bullets);
    return this.convertToScoredBullets(parsed, batch.bullets, batch.originalBullets);
  }

  /**
   * Parse OpenAI JSON response with better error handling
   */
  private parseOpenAIResponse(content: string, inputBullets: Array<{ id: string; text: string }>): OpenAIBatchResponse {
    let parsed: any;
    
    try {
      // Try to clean up common JSON issues
      let cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to extract JSON if there's extra text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      parsed = JSON.parse(cleanedContent);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      console.error('Parse error:', e);
      
      // Return fallback structure
      return {
        bullets: inputBullets.map(bullet => ({
          id: bullet.id,
          score: 5.0,
          reasoning: 'Parse error fallback',
          skill_matches: [],
          quality_flags: ['fallback']
        }))
      };
    }

    if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
      console.warn('OpenAI response missing bullets array, using fallback');
      return {
        bullets: inputBullets.map(bullet => ({
          id: bullet.id,
          score: 5.0,
          reasoning: 'Missing bullets array',
          skill_matches: [],
          quality_flags: ['fallback']
        }))
      };
    }

    // Ensure we have results for all input bullets
    if (parsed.bullets.length !== inputBullets.length) {
      console.warn(`Expected ${inputBullets.length} bullets, got ${parsed.bullets.length}. Filling missing ones.`);
      
      const resultMap = new Map(parsed.bullets.map((b: any) => [String(b.id), b]));
      const completeResults: Array<{
        id: string;
        score: number;
        reasoning: string;
        skill_matches: string[];
        quality_flags: string[];
      }> = inputBullets.map(bullet => {
        const existing = resultMap.get(String(bullet.id)) as any;
        
        // Ensure existing result has correct structure, or use fallback
        if (existing && existing.id && typeof existing.score === 'number') {
          return {
            id: String(existing.id),
            score: Number(existing.score),
            reasoning: String(existing.reasoning || 'OpenAI response'),
            skill_matches: Array.isArray(existing.skill_matches) ? existing.skill_matches : [],
            quality_flags: Array.isArray(existing.quality_flags) ? existing.quality_flags : []
          };
        } else {
          return {
            id: bullet.id,
            score: 5.0,
            reasoning: 'Missing from response',
            skill_matches: [],
            quality_flags: ['fallback']
          };
        }
      });
      
      return { bullets: completeResults };
    }

    return parsed;
  }

  /**
   * Convert OpenAI response to ScoredBullet format - FIXED
   */
  private convertToScoredBullets(
    parsed: OpenAIBatchResponse, 
    inputBullets: Array<{ id: string; text: string }>,
    originalBullets: ScoredBullet[]
  ): ScoredBullet[] {
    const results: ScoredBullet[] = [];
    
    for (const bullet of inputBullets) {
      // Find the original bullet to get projectId and roleId
      const originalBullet = originalBullets.find(b => b.bulletId === bullet.id);
      const result = parsed.bullets.find(b => b.id === bullet.id);
      
      if (result) {
        results.push({
          bulletId: bullet.id,
          text: bullet.text,
          projectId: originalBullet?.projectId || '',
          roleId: originalBullet?.roleId || '',
          score: Math.max(1.0, Math.min(10.0, result.score)),
          normalizedScore: 0,
          reasons: result.reasoning || 'OpenAI scoring',
          skillHits: Array.isArray(result.skill_matches) ? result.skill_matches : [],
          flags: Array.isArray(result.quality_flags) ? result.quality_flags : []
        });
      } else {
        // Fallback for missing bullets
        results.push({
          bulletId: bullet.id,
          text: bullet.text,
          projectId: originalBullet?.projectId || '',
          roleId: originalBullet?.roleId || '',
          score: 5.0,
          normalizedScore: 0,
          reasons: 'OpenAI fallback',
          skillHits: [],
          flags: ['fallback']
        });
      }
    }
    
    return results;
  }

  /**
   * Normalize scores across all bullets
   */
  private normalizeScores(bullets: ScoredBullet[], skills: string[]): ScoredBullet[] {
    if (bullets.length === 0) return bullets;
    
    // Find score range
    const scores = bullets.map(b => b.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    
    // Normalize to 0-1 range, but keep relative ordering
    return bullets.map(bullet => ({
      ...bullet,
      normalizedScore: scoreRange > 0 
        ? 0.1 + 0.8 * ((bullet.score - minScore) / scoreRange) // Scale to 0.1-0.9
        : 0.5 // All same score
    }));
  }

  /**
   * Create batch request structure
   */
  private createBatchRequest(jobAnalysis: JobAnalysis, bullets: ScoredBullet[]): OpenAIBatchRequest {
    return {
      jobTitle: jobAnalysis.title,
      jobDescription: jobAnalysis.description,
      skills: jobAnalysis.extractedSkills,
      bullets: bullets.map(b => ({ id: b.bulletId, text: b.text })),
      originalBullets: bullets
    };
  }

  /**
   * Estimate base token usage - updated for trimmed prompts
   */
  private estimateBaseTokens(jobAnalysis: JobAnalysis): number {
    const titleTokens = jobAnalysis.title.length * TOKENS_PER_CHAR;
    const descTokens = Math.min(jobAnalysis.description.length * TOKENS_PER_CHAR, MAX_JD_CHARS * TOKENS_PER_CHAR);
    const skillsTokens = jobAnalysis.extractedSkills.join(',').length * TOKENS_PER_CHAR;
    const systemPromptTokens = 250; // Reduced estimate for trimmed prompt
    
    return titleTokens + descTokens + skillsTokens + systemPromptTokens;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}