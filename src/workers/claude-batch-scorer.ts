/**
 * Claude Batch Scorer
 * Handles Claude API calls for bullet scoring
 * NOT CURRENTLY IN USE - API Key cannot be used in browser at this time
 * Kept for future use 
 */

import { getOpenAIService } from './openai-service';
import type { JobAnalysis } from '../types';
import type { ScoredBullet } from './openai-ranking-engine';

// ============================================================================
// Configuration
// ============================================================================

const MAX_TOKENS_PER_BATCH = 6000;
const MIN_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 30;
const TOKENS_PER_CHAR = 0.25;

// ============================================================================
// Types
// ============================================================================

interface BatchRequest {
  jobTitle: string;
  jobDescription: string;
  skills: string[];
  bullets: Array<{ id: string; text: string }>;
}

interface BatchResponse {
  count_in: number;
  count_out: number;
  scores: Array<{
    id: string;
    score: number;
    reasons: string;
    skill_hits: string[];
    flags: string[];
  }>;
}

// ============================================================================
// Claude Batch Scorer
// ============================================================================

export class ClaudeBatchScorer {
  
  /**
   * Score bullets using Claude in batches
   */
  async scoreBullets(
    jobAnalysis: JobAnalysis,
    bullets: ScoredBullet[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<ScoredBullet[]> {
    const anthropicService = getOpenAIService();
    
    if (!anthropicService.hasApiKey()) {
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
      
      onProgress?.(`Claude scoring (batch ${i + 1}/${batches.length})...`, progress);

      try {
        const scored = await this.scoreBatch(batch, anthropicService);
        allScored.push(...scored);
      } catch (error) {
        console.warn(`Batch ${i + 1} failed, retrying:`, error);
        // Retry once
        await this.sleep(1000);
        try {
          const scored = await this.scoreBatch(batch, anthropicService, true);
          allScored.push(...scored);
        } catch (retryError) {
          console.error(`Batch ${i + 1} failed after retry:`, retryError);
          throw new Error(`Batch scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return this.normalizeScores(allScored, jobAnalysis.extractedSkills);
  }

  /**
   * Create batches with dynamic sizing
   */
  private createBatches(jobAnalysis: JobAnalysis, bullets: ScoredBullet[]): BatchRequest[] {
    const baseTokens = this.estimateBaseTokens(jobAnalysis);
    const batches: BatchRequest[] = [];
    
    let currentBatch: ScoredBullet[] = [];
    let currentTokens = baseTokens;

    for (const bullet of bullets) {
      const bulletTokens = bullet.text.length * TOKENS_PER_CHAR + 50;
      
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
   * Score a single batch
   */
  private async scoreBatch(
    batch: BatchRequest,
    anthropicService: any,
    isRetry: boolean = false
  ): Promise<ScoredBullet[]> {
    const systemMessage = `You are a strict JSON API. Output ONLY JSON, no prose, no markdown, no comments.
Return one result for every input bullet, preserving IDs exactly. Do not rewrite text.
All scores must be numbers with one decimal place in the range 1.0–10.0.
"skill_hits" must contain only values from the provided SKILLS list.${isRetry ? '\nYou omitted items in the previous response; return all N with IDs.' : ''}`;

    const userMessage = `Rate each resume bullet's relevance to this job.

JOB: ${batch.jobTitle}
DESCRIPTION: ${batch.jobDescription.substring(0, 2000)}

SKILLS: ${JSON.stringify(batch.skills)}
BULLETS: ${JSON.stringify(batch.bullets)}

Return JSON: {"count_in": <number>, "count_out": <number>, "scores": [{"id": "<id>", "score": <1.0-10.0>, "reasons": "<12 words max>", "skill_hits": ["<skills>"], "flags": ["none"]}]}`;

    const response = await anthropicService.createChatCompletion({
      model: 'claude-3-haiku-20240307',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from Claude');
    }

    const parsed = this.parseResponse(content, batch.bullets);
    return this.convertToScoredBullets(parsed, batch.bullets);
  }

  /**
   * Parse and validate Claude response
   */
  private parseResponse(content: string, inputBullets: Array<{ id: string; text: string }>): BatchResponse {
    let parsed: any;
    
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Basic validation
    if (!parsed.scores || !Array.isArray(parsed.scores)) {
      throw new Error('Invalid response structure');
    }

    if (parsed.scores.length !== inputBullets.length) {
      throw new Error(`Expected ${inputBullets.length} scores, got ${parsed.scores.length}`);
    }

    return parsed;
  }

  /**
   * Convert parsed response to ScoredBullet format
   */
  private convertToScoredBullets(
    parsed: BatchResponse, 
    inputBullets: Array<{ id: string; text: string }>
  ): ScoredBullet[] {
    return inputBullets.map(bullet => {
      const result = parsed.scores.find(s => s.id === bullet.id);
      if (!result) {
        throw new Error(`Missing score for bullet ${bullet.id}`);
      }

      return {
        bulletId: bullet.id,
        text: bullet.text,
        projectId: '',
        roleId: '',
        score: Math.max(1.0, Math.min(10.0, result.score)),
        normalizedScore: 0,
        reasons: (result.reasons || '').substring(0, 60),
        skillHits: Array.isArray(result.skill_hits) ? result.skill_hits : [],
        flags: Array.isArray(result.flags) ? result.flags : ['none']
      };
    });
  }

  /**
   * Normalize scores and add coverage bonuses
   */
  private normalizeScores(bullets: ScoredBullet[], jobSkills: string[]): ScoredBullet[] {
    if (bullets.length === 0) return bullets;

    const scores = bullets.map(b => b.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore || 1;

    const skillsCovered = new Set<string>();

    return bullets.map(bullet => {
      const normalizedScore = (bullet.score - minScore) / scoreRange;
      
      // Coverage bonus for new skills
      const newSkills = bullet.skillHits.filter(skill => !skillsCovered.has(skill));
      const coverageBonus = Math.min(newSkills.length * 0.02, 0.2);
      newSkills.forEach(skill => skillsCovered.add(skill));

      const finalScore = 0.85 * normalizedScore + 0.15 * 0.5 + coverageBonus;

      return {
        ...bullet,
        normalizedScore: finalScore
      };
    });
  }

  private createBatchRequest(jobAnalysis: JobAnalysis, bullets: ScoredBullet[]): BatchRequest {
    return {
      jobTitle: jobAnalysis.title,
      jobDescription: jobAnalysis.description,
      skills: jobAnalysis.extractedSkills,
      bullets: bullets.map(b => ({ id: b.bulletId, text: b.text }))
    };
  }

  private estimateBaseTokens(jobAnalysis: JobAnalysis): number {
    const basePrompt = 1000;
    const jobTokens = (jobAnalysis.title.length + jobAnalysis.description.length) * TOKENS_PER_CHAR;
    const skillsTokens = jobAnalysis.extractedSkills.join('').length * TOKENS_PER_CHAR;
    return basePrompt + jobTokens + skillsTokens;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}