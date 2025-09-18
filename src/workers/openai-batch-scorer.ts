/**
 * OpenAI Batch Scorer
 * Handles OpenAI API calls for bullet scoring with OpenAI-specific patterns
 */

import { getOpenAIService } from './openai-service';
import type { JobAnalysis } from '../types';
import type { ScoredBullet } from './openai-ranking-engine';

// ============================================================================
// Configuration - OpenAI optimized
// ============================================================================

const MAX_TOKENS_PER_BATCH = 4000; // OpenAI has different token limits
const MIN_BATCH_SIZE = 8;
const MAX_BATCH_SIZE = 20; // Smaller batches for OpenAI
const TOKENS_PER_CHAR = 0.3; // OpenAI tokenization is different

// ============================================================================
// Types
// ============================================================================

interface OpenAIBatchRequest {
    jobTitle: string;
    jobDescription: string;
    skills: string[];
    bullets: Array<{ id: string; text: string }>;
    originalBullets: ScoredBullet[];
}

interface OpenAIBatchResponse {
  bullets: Array<{
    id: string;
    score: number;
    reasoning: string;
    skill_matches: string[];
    quality_flags: string[];
  }>;
}

// ============================================================================
// OpenAI Batch Scorer
// ============================================================================

export class OpenAIBatchScorer {
  
  /**
   * Score bullets using OpenAI in batches
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
    
    // Score each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) {
        console.warn(`Batch ${i} is undefined, skipping`);
        continue;
      }
      
      const progress = 0.4 + (i / batches.length) * 0.4;
      
      onProgress?.(`OpenAI scoring (batch ${i + 1}/${batches.length})...`, progress);

      try {
        const scored = await this.scoreBatch(batch, openaiService);
        allScored.push(...scored);
      } catch (error) {
        console.warn(`OpenAI batch ${i + 1} failed, retrying:`, error);
        // Single retry
        await this.sleep(1000);
        try {
          const scored = await this.scoreBatch(batch, openaiService);
          allScored.push(...scored);
        } catch (retryError) {
          console.error(`OpenAI batch ${i + 1} failed after retry:`, retryError);
          throw new Error(`OpenAI batch scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return this.normalizeScores(allScored, jobAnalysis.extractedSkills);
  }

  /**
   * Create batches optimized for OpenAI
   */
  private createBatches(jobAnalysis: JobAnalysis, bullets: ScoredBullet[]): OpenAIBatchRequest[] {
    const baseTokens = this.estimateBaseTokens(jobAnalysis);
    const batches: OpenAIBatchRequest[] = [];
    
    let currentBatch: ScoredBullet[] = [];
    let currentTokens = baseTokens;

    for (const bullet of bullets) {
      const bulletTokens = bullet.text.length * TOKENS_PER_CHAR + 60; // OpenAI overhead
      
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
   * Score a single batch with OpenAI
   */
  private async scoreBatch(
    batch: OpenAIBatchRequest,
    openaiService: any
  ): Promise<ScoredBullet[]> {
    
    // OpenAI-optimized system prompt
    const systemPrompt = `You are a resume expert helping rank bullet points for job applications.

Rate each bullet point's relevance to the job on a scale of 1.0 to 10.0.

Consider:
- Direct skill/experience matches
- Quantified achievements and impact
- Leadership and cross-functional collaboration
- Technical depth and complexity
- Business results and outcomes

Respond with ONLY a JSON object in this exact format:
{
  "bullets": [
    {
      "id": "exact_id_from_input",
      "score": 8.5,
      "reasoning": "Brief explanation under 15 words",
      "skill_matches": ["list", "of", "matching", "skills"],
      "quality_flags": ["quantified", "leadership", "technical"]
    }
  ]
}`;

    // OpenAI-optimized user prompt
    const userPrompt = `Job Title: ${batch.jobTitle}

Job Requirements:
${batch.jobDescription.substring(0, 1500)}

Required Skills: ${batch.skills.join(', ')}

Rate these ${batch.bullets.length} bullet points:
${batch.bullets.map(b => `ID: ${b.id}\nText: ${b.text}`).join('\n\n')}

Return JSON with ${batch.bullets.length} scored bullets.`;

    const response = await openaiService.createChatCompletion({
      model: 'gpt-4o-mini', // OpenAI model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent scoring
      max_tokens: 2000,
      response_format: { type: "json_object" } // OpenAI JSON mode
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = this.parseOpenAIResponse(content, batch.bullets);
    return this.convertToScoredBullets(parsed, batch.bullets, batch.originalBullets); // ✅ Pass original bullets
  }

  /**
   * Parse OpenAI JSON response
   */
  private parseOpenAIResponse(content: string, inputBullets: Array<{ id: string; text: string }>): OpenAIBatchResponse {
    let parsed: any;
    
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON from OpenAI: ${e instanceof Error ? e.message : 'Parse error'}`);
    }

    if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
      throw new Error('OpenAI response missing bullets array');
    }

    if (parsed.bullets.length !== inputBullets.length) {
      console.warn(`Expected ${inputBullets.length} bullets, got ${parsed.bullets.length}`);
      // OpenAI sometimes drops bullets, so we'll work with what we get
    }

    return parsed;
  }

  /**
 * Convert OpenAI response to ScoredBullet format - FIXED
 */
private convertToScoredBullets(
    parsed: OpenAIBatchResponse, 
    inputBullets: Array<{ id: string; text: string }>,
    originalBullets: ScoredBullet[] // ✅ Add this parameter
  ): ScoredBullet[] {
    const results: ScoredBullet[] = [];
    
    for (const bullet of inputBullets) {
      // ✅ Find the original bullet to get projectId and roleId
      const originalBullet = originalBullets.find(b => b.bulletId === bullet.id);
      const result = parsed.bullets.find(b => b.id === bullet.id);
      
      if (result) {
        results.push({
          bulletId: bullet.id,
          text: bullet.text,
          projectId: originalBullet?.projectId || '', // ✅ Preserve original projectId
          roleId: originalBullet?.roleId || '',       // ✅ Preserve original roleId
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
          projectId: originalBullet?.projectId || '', // ✅ Preserve original projectId
          roleId: originalBullet?.roleId || '',       // ✅ Preserve original roleId
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
      originalBullets: bullets // Include the original bullets
    };
  }

  /**
   * Estimate base token usage
   */
  private estimateBaseTokens(jobAnalysis: JobAnalysis): number {
    const titleTokens = jobAnalysis.title.length * TOKENS_PER_CHAR;
    const descTokens = Math.min(jobAnalysis.description.length * TOKENS_PER_CHAR, 500);
    const skillsTokens = jobAnalysis.extractedSkills.join(',').length * TOKENS_PER_CHAR;
    const systemPromptTokens = 300; // Estimated system prompt
    
    return titleTokens + descTokens + skillsTokens + systemPromptTokens;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}