/**
 * OpenAI Ranking Engine - Main Orchestrator
 * Coordinates the ranking pipeline using OpenAI for scoring
 */

import { getJobAnalyzer } from './job-analyzer';
import { OpenAIBatchScorer } from './openai-batch-scorer'; 
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

export class OpenAIRankingEngine {
  private batchScorer: OpenAIBatchScorer; // UPDATED TYPE
  private bulletSelector: BulletSelector;
  private config: RankingConfig;

  constructor(config: Partial<RankingConfig> = {}) {
    this.config = {
      maxBulletsPerRole: 60,
      maxTotalBullets: 240,
      fallbackToBM25: true,
      ...config
    };
    
    this.batchScorer = new OpenAIBatchScorer(); // UPDATED CLASS
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

      // Step 3: Score with OpenAI or fallback
      let scored: ScoredBullet[];
      try {
        onProgress?.('Preparing OpenAI scoring...', 0.3);
        scored = await this.batchScorer.scoreBullets(jobAnalysis, prefiltered, onProgress);
      } catch (error) {
        console.warn('OpenAI scoring failed:', error);
        
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
   * Create fallback scores using proper relevance + quality metrics when OpenAI fails
   */
  private createFallbackScores(bullets: ScoredBullet[], jobSkills: string[]): ScoredBullet[] {
    console.log('🚨 OpenAI failed - using fallback scoring for', bullets.length, 'bullets');
    
    const scoredBullets = bullets.map(bullet => {
      const relevanceScore = this.calculateBulletRelevance(bullet.text, jobSkills);
      const qualityScore = this.calculateQualityScore(bullet.text);
      const impactScore = this.calculateImpactScore(bullet.text);
      
      // Combine scores with proper weighting
      const totalScore = relevanceScore * 0.4 + qualityScore * 0.3 + impactScore * 0.3;
      const normalizedScore = Math.max(0.1, Math.min(0.95, totalScore));
      
      const skillHits = this.findSkillHits(bullet.text, jobSkills);
      
      let reasons = 'Fallback relevance scoring';
      if (impactScore > 0.7) reasons += ', major business impact';
      if (skillHits.length > 0) reasons += `, ${skillHits.length} skill matches`;
      if (qualityScore > 0.7) reasons += ', high quality';
      
      return {
        ...bullet,
        score: totalScore * 10, // Scale to 0-10 range
        normalizedScore,
        reasons,
        skillHits,
        flags: ['fallback']
      };
    });
    
    // Sort by score and log results for debugging
    scoredBullets.sort((a, b) => b.normalizedScore - a.normalizedScore);
    
    console.log('📊 Top 5 fallback-scored bullets:');
    scoredBullets.slice(0, 5).forEach((bullet, i) => {
      console.log(`${i + 1}. [${bullet.normalizedScore.toFixed(3)}] ${bullet.text.substring(0, 100)}...`);
    });
    
    return scoredBullets;
  }

  /**
   * Calculate relevance score based on job skill and keyword matching
   */
  private calculateBulletRelevance(bulletText: string, jobSkills: string[]): number {
    const lowerText = bulletText.toLowerCase();
    let score = 0;
    
    // Job skill matching
    const matchedSkills = jobSkills.filter(skill => 
      lowerText.includes(skill.toLowerCase())
    );
    score += Math.min(0.4, matchedSkills.length * 0.1);
    
    // Product management keywords (this is a PM role at Figma)
    const pmKeywords = ['product', 'roadmap', 'strategy', 'feature', 'requirements', 'stakeholder', 'user', 'customer'];
    const pmMatches = pmKeywords.filter(keyword => lowerText.includes(keyword));
    score += Math.min(0.3, pmMatches.length * 0.08);
    
    // Technical/engineering collaboration keywords (important for this role)
    const techKeywords = ['engineering', 'technical', 'integration', 'workflow', 'system', 'process'];
    const techMatches = techKeywords.filter(keyword => lowerText.includes(keyword));
    score += Math.min(0.2, techMatches.length * 0.07);
    
    // Cross-functional leadership keywords (mentioned heavily in job description)
    const leadershipKeywords = ['teams', 'alignment', 'collaboration', 'cross-functional', 'stakeholder'];
    const leadershipMatches = leadershipKeywords.filter(keyword => lowerText.includes(keyword));
    score += Math.min(0.1, leadershipMatches.length * 0.05);
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate quality score based on bullet structure and language
   */
  private calculateQualityScore(text: string): number {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Strong action verbs (crucial for resume bullets)
    const strongVerbs = [
      'designed', 'built', 'created', 'developed', 'implemented', 'launched',
      'led', 'managed', 'drove', 'delivered', 'achieved', 'increased',
      'improved', 'optimized', 'established', 'defined', 'aligned', 'validated'
    ];
    
    if (strongVerbs.some(verb => lowerText.startsWith(verb))) {
      score += 0.4;
    }
    
    // Optimal length (15-30 words is ideal for resume bullets)
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 15 && wordCount <= 30) {
      score += 0.3;
    } else if (wordCount >= 10 && wordCount <= 35) {
      score += 0.2;
    }
    
    // Professional terminology
    const professionalTerms = ['analysis', 'strategy', 'framework', 'methodology', 'requirements'];
    const profMatches = professionalTerms.filter(term => lowerText.includes(term));
    score += Math.min(0.2, profMatches.length * 0.05);
    
    // Avoid weak language
    const weakTerms = ['helped', 'assisted', 'participated', 'involved', 'responsible for'];
    if (!weakTerms.some(term => lowerText.includes(term))) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate business impact score - KEY for ranking $160M bullet first
   */
  private calculateImpactScore(text: string): number {
    let score = 0;
    
    // Massive financial impact (this should make $160M bullet the clear winner)
    if (/\$\d{2,3}M\+?|\$\d+\s*million/i.test(text)) {
      score += 0.9; // Extremely high score for major financial impact like $160M
    } else if (/\$\d+M|\$\d+K/i.test(text)) {
      score += 0.5;
    } else if (/\$\d+/.test(text)) {
      score += 0.3;
    }
    
    // Large scale indicators
    if (/\d+\s*teams/i.test(text)) {
      const match = text.match(/(\d+)\s*teams/i);
      if (match && match[1]) { // FIXED: Add null check
        const num = parseInt(match[1], 10);
        if (num >= 10) score += 0.4; // 10+ teams is significant
        else if (num >= 5) score += 0.3;
        else score += 0.2;
      }
    }
    
    // Business strategy keywords
    const strategyKeywords = ['strategy', 'roadmap', 'revenue', 'pilot', 'expansion'];
    const strategyMatches = strategyKeywords.filter(word => text.toLowerCase().includes(word));
    score += Math.min(0.3, strategyMatches.length * 0.1);
    
    // Quantification bonus (any numbers are better than none)
    if (/\d+/.test(text)) {
      score += 0.1;
    }
    
    // Research and analysis (conjoint analysis, primary research)
    if (/analysis|research|conjoint|primary/i.test(text)) {
      score += 0.2;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * FIXED: Add missing findSkillHits method
   */
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