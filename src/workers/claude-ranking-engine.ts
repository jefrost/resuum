/**
 * Claude Ranking Engine - Main Orchestrator
 * Coordinates the ranking pipeline without business logic
 */

import { getJobAnalyzer } from './job-analyzer';
import { ClaudeBatchScorer } from './claude-batch-scorer';
import { BulletSelector } from './bullet-selector';
import { prefilterWithBM25 } from '../utils/bm25-filter';
import type { Bullet, Role } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ScoredBullet {
  bulletId: string;
  text: string;
  projectId: string;
  roleId: string;
  score: number;
  normalizedScore: number;
  reasons: string;
  skillHits: string[];
  flags: string[];
}

interface RankingConfig {
  maxBulletsPerRole: number;
  maxTotalBullets: number;
  fallbackToBM25: boolean;
}

// ============================================================================
// Main Engine
// ============================================================================

export class ClaudeRankingEngine {
  private batchScorer: ClaudeBatchScorer;
  private bulletSelector: BulletSelector;
  private config: RankingConfig;

  constructor(config: Partial<RankingConfig> = {}) {
    this.config = {
      maxBulletsPerRole: 60,
      maxTotalBullets: 240,
      fallbackToBM25: true,
      ...config
    };
    
    this.batchScorer = new ClaudeBatchScorer();
    this.bulletSelector = new BulletSelector();
  }

  /**
   * Main ranking pipeline
   */
  async rankBullets(
    jobTitle: string,
    jobDescription: string,
    bullets: Bullet[],
    roles: Role[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<ScoredBullet[]> {
    try {
      // Step 1: Analyze job
      onProgress?.('Analyzing job description...', 0.1);
      const jobAnalyzer = getJobAnalyzer();
      const jobAnalysis = await jobAnalyzer.analyzeJob(jobTitle, jobDescription);
      
      // Step 2: Prefilter bullets
      onProgress?.('Filtering bullet points...', 0.2);
      const prefiltered = this.prefilterBullets(jobAnalysis, bullets, roles);
      
      if (prefiltered.length === 0) {
        throw new Error('No relevant bullet points found for this job description');
      }

      // Step 3: Score with Claude or fallback
      let scored: ScoredBullet[];
      try {
        onProgress?.('Preparing Claude scoring...', 0.3);
        scored = await this.batchScorer.scoreBullets(jobAnalysis, prefiltered, onProgress);
      } catch (error) {
        console.warn('Claude scoring failed:', error);
        
        if (this.config.fallbackToBM25) {
          onProgress?.('Using fallback ranking...', 0.7);
          scored = this.createFallbackScores(prefiltered, jobAnalysis.extractedSkills);
        } else {
          throw error;
        }
      }

      // Step 4: Apply business rules and select final set
      onProgress?.('Selecting optimal set...', 0.9);
      return this.bulletSelector.selectFinalBullets(scored, roles);

    } catch (error) {
      throw new Error(`Ranking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prefilter bullets using BM25
   */
  private prefilterBullets(jobAnalysis: any, bullets: Bullet[], roles: Role[]): ScoredBullet[] {
    const bulletsByRole = new Map<string, Bullet[]>();
    
    // Group by role
    for (const bullet of bullets) {
      if (!bulletsByRole.has(bullet.roleId)) {
        bulletsByRole.set(bullet.roleId, []);
      }
      bulletsByRole.get(bullet.roleId)!.push(bullet);
    }

    const prefiltered: ScoredBullet[] = [];
    let totalProcessed = 0;

    // Filter each role separately
    for (const [roleId, roleBullets] of bulletsByRole) {
      if (totalProcessed >= this.config.maxTotalBullets) break;

      const roleLimit = Math.min(
        this.config.maxBulletsPerRole,
        this.config.maxTotalBullets - totalProcessed
      );

      const filtered = prefilterWithBM25(jobAnalysis, roleBullets, roleLimit);

      // Convert to ScoredBullet format
      for (const bullet of filtered) {
        prefiltered.push({
          bulletId: bullet.id,
          text: bullet.text,
          projectId: bullet.projectId,
          roleId: bullet.roleId,
          score: 5.0,
          normalizedScore: 0.5,
          reasons: 'Prefiltered candidate',
          skillHits: [],
          flags: []
        });
      }

      totalProcessed += filtered.length;
    }

    return prefiltered;
  }

  /**
   * Create fallback scores when Claude fails
   */
  private createFallbackScores(bullets: ScoredBullet[], jobSkills: string[]): ScoredBullet[] {
    return bullets.map(bullet => ({
      ...bullet,
      score: 5.0 + Math.random() * 2,
      normalizedScore: 0.5 + Math.random() * 0.3,
      reasons: 'Keyword-based match',
      skillHits: this.findSkillHits(bullet.text, jobSkills),
      flags: ['fallback']
    }));
  }

  private findSkillHits(text: string, skills: string[]): string[] {
    const hits: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const skill of skills) {
      if (lowerText.includes(skill.toLowerCase())) {
        hits.push(skill);
      }
    }
    
    return hits.slice(0, 5); // Limit hits
  }
}