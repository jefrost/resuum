/**
 * Recommendation Algorithm Implementation
 * Core logic for project ranking, bullet selection, and quality scoring
 */

import { 
    cosineSimilarity, 
    isRedundant, 
    recordVectorOperation 
  } from './vector-math';
  
  // ============================================================================
  // Types and Interfaces
  // ============================================================================
  
  export interface AlgorithmWeights {
    relevance: number;        // α - relevance to job description
    quality: number;          // μ - quality features score
    recency: number;          // ρ - recency bias
    redundancyPenalty: number; // λ - redundancy penalty
  }
  
  export interface QualityFeatures {
    hasNumbers: boolean;
    actionVerb: boolean;
    lengthOk: boolean;
  }
  
  export interface ProjectScore {
    projectId: string;
    score: number;
    similarity: number;
    recencyFactor: number;
  }
  
  export interface BulletScore {
    bulletId: string;
    score: number;
    relevance: number;
    qualityScore: number;
    redundancyScore: number;
  }
  
  export interface ProjectData {
    id: string;
    centroidVector: Float32Array;
    recencyFactor: number;
  }
  
  export interface BulletData {
    id: string;
    projectId: string;
    vector: Float32Array;
    qualityFeatures: QualityFeatures;
  }
  
  // ============================================================================
  // Algorithm Timing Constants
  // ============================================================================
  
  export const TIMING_BUDGETS = {
    SELECTION_PHASE: 1000, // 1s hard cap for selection
    VECTOR_OPERATION: 100, // 100ms per vector operation batch
    PROJECT_RANKING: 200,  // 200ms for project ranking
    BULLET_SELECTION: 500  // 500ms for bullet selection
  } as const;
  
  // ============================================================================
  // Quality Scoring Functions
  // ============================================================================
  
  /**
   * Calculate quality score based on bullet features
   */
  export function calculateQualityScore(features: QualityFeatures, weights: AlgorithmWeights): number {
    let score = 0;
    
    if (features.hasNumbers) {
      score += 0.20; // Quantified results bonus
    }
    
    if (features.actionVerb) {
      score += 0.10; // Strong action verb bonus
    }
    
    if (features.lengthOk) {
      score += 0.05; // Appropriate length bonus
    }
    
    // Cap total quality bonus at 0.35
    return Math.min(score, 0.35) * weights.quality;
  }
  
  /**
   * Calculate recency factor based on role order and time
   */
  export function calculateRecencyFactor(
    roleOrderIndex: number,
    totalRoles: number,
    startDate?: string,
    endDate?: string
  ): number {
    // Base recency on role order (most recent = 0)
    const roleRecency = totalRoles > 1 ? (totalRoles - roleOrderIndex) / totalRoles : 1.0;
    
    // Add time-based recency if dates available
    if (startDate) {
      try {
        const endTime = endDate ? new Date(endDate) : new Date();
        const now = new Date();
        
        const monthsSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60 * 24 * 30);
        const timeRecency = Math.max(0, 1 - monthsSinceEnd / 60); // Decay over 5 years
        
        return (roleRecency + timeRecency) / 2;
      } catch (error) {
        console.warn('Invalid date format in recency calculation:', error);
        return roleRecency;
      }
    }
    
    return roleRecency;
  }
  
  // ============================================================================
  // Project Ranking Algorithm
  // ============================================================================
  
  /**
   * Rank projects by relevance to job description
   */
  export function rankProjects(
    jobVector: Float32Array,
    projects: ProjectData[],
    weights: AlgorithmWeights,
    startTime: number
  ): ProjectScore[] {
    const timeoutMs = TIMING_BUDGETS.PROJECT_RANKING;
    const scores: ProjectScore[] = [];
    
    for (const project of projects) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Project ranking timeout after ${timeoutMs}ms`);
      }
      
      // Validate project data
      if (!project.id || !project.centroidVector) {
        console.warn('Skipping invalid project:', project.id);
        continue;
      }
      
      try {
        const similarity = cosineSimilarity(jobVector, project.centroidVector);
        const score = weights.relevance * similarity + weights.recency * project.recencyFactor;
        
        scores.push({
          projectId: project.id,
          score,
          similarity,
          recencyFactor: project.recencyFactor
        });
      } catch (error) {
        console.warn(`Failed to score project ${project.id}:`, error);
        recordVectorOperation(Date.now() - startTime, false, false);
        // Continue with other projects
      }
    }
    
    // Sort by score (highest first)
    return scores.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Create project shortlist based on ranking and limits
   */
  export function createProjectShortlist(
    projectScores: ProjectScore[],
    roleLimit: number,
    minProjects: number = 3,
    maxProjects: number = 8
  ): string[] {
    // M = clamp(3, 8, 2×roleLimit) as specified in PRD
    const shortlistSize = Math.min(maxProjects, Math.max(minProjects, 2 * roleLimit));
    
    return projectScores
      .slice(0, shortlistSize)
      .map(p => p.projectId);
  }
  
  // ============================================================================
  // Bullet Selection Algorithm
  // ============================================================================
  
  /**
   * Score bullets for selection
   */
  export function scoreBullets(
    jobVector: Float32Array,
    bullets: BulletData[],
    weights: AlgorithmWeights,
    startTime: number
  ): Array<{
    bullet: BulletData;
    relevance: number;
    qualityScore: number;
    combinedScore: number;
  }> {
    const timeoutMs = TIMING_BUDGETS.BULLET_SELECTION;
    const scoredBullets: Array<{
      bullet: BulletData;
      relevance: number;
      qualityScore: number;
      combinedScore: number;
    }> = [];
    
    for (const bullet of bullets) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Bullet scoring timeout after ${timeoutMs}ms`);
      }
      
      try {
        const relevance = cosineSimilarity(jobVector, bullet.vector);
        const qualityScore = calculateQualityScore(bullet.qualityFeatures, weights);
        const combinedScore = relevance * weights.relevance + qualityScore;
        
        scoredBullets.push({
          bullet,
          relevance,
          qualityScore,
          combinedScore
        });
      } catch (error) {
        console.warn(`Failed to score bullet ${bullet.id}:`, error);
        recordVectorOperation(Date.now() - startTime, false, false);
        // Continue with other bullets
      }
    }
    
    // Sort by combined score (highest first)
    return scoredBullets.sort((a, b) => b.combinedScore - a.combinedScore);
  }
  
  /**
   * Select best bullets with MMR and constraints
   */
  export function selectBullets(
    jobVector: Float32Array,
    bullets: BulletData[],
    projectShortlist: string[],
    maxPerProject: number,
    roleLimit: number,
    weights: AlgorithmWeights,
    startTime: number
  ): BulletScore[] {
    const timeoutMs = TIMING_BUDGETS.BULLET_SELECTION;
    const selected: BulletScore[] = [];
    const selectedVectors: Float32Array[] = [];
    const projectCounts = new Map<string, number>();
    
    // Filter bullets to shortlisted projects
    const candidateBullets = bullets.filter(bullet => 
      bullet && bullet.id && bullet.projectId && 
      projectShortlist.includes(bullet.projectId) &&
      bullet.vector
    );
    
    // Score all candidate bullets
    const scoredBullets = scoreBullets(jobVector, candidateBullets, weights, startTime);
    
    // Select bullets with MMR and constraints
    for (const item of scoredBullets) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`MMR selection timeout after ${timeoutMs}ms`);
      }
      
      // Stop if we've reached role limit
      if (selected.length >= roleLimit) {
        break;
      }
      
      // Check per-project limit
      const projectCount = projectCounts.get(item.bullet.projectId) || 0;
      if (projectCount >= maxPerProject) {
        continue;
      }
      
      // Check redundancy using MMR threshold (0.85 as specified)
      if (isRedundant(item.bullet.vector, selectedVectors, 0.85)) {
        continue;
      }
      
      // Calculate redundancy score for final scoring
      let redundancyScore = 0;
      if (selectedVectors.length > 0) {
        try {
          redundancyScore = Math.max(
            ...selectedVectors.map(selected => 
              cosineSimilarity(item.bullet.vector, selected)
            )
          );
        } catch (error) {
          console.warn('Redundancy calculation failed:', error);
          redundancyScore = 0;
        }
      }
      
      // Calculate final score with redundancy penalty
      const finalScore = 
        item.combinedScore - 
        redundancyScore * weights.redundancyPenalty;
      
      // Accept bullet
      selected.push({
        bulletId: item.bullet.id,
        score: finalScore,
        relevance: item.relevance,
        qualityScore: item.qualityScore,
        redundancyScore
      });
      
      selectedVectors.push(item.bullet.vector);
      projectCounts.set(item.bullet.projectId, projectCount + 1);
    }
    
    return selected;
  }
  
  // ============================================================================
  // Main Recommendation Function
  // ============================================================================
  
  /**
   * Generate complete recommendations
   */
  export function generateRecommendations(
    jobVector: Float32Array,
    projects: ProjectData[],
    bullets: BulletData[],
    roleLimit: number,
    maxPerProject: number,
    weights: AlgorithmWeights
  ): {
    projectScores: ProjectScore[];
    selectedBullets: BulletScore[];
    processingTime: number;
  } {
    const startTime = Date.now();
    
    try {
      // Validate input data
      if (!jobVector || !projects || !bullets || !weights) {
        throw new Error('Missing required data for recommendation');
      }
      
      // Phase 1: Project ranking
      const projectScores = rankProjects(jobVector, projects, weights, startTime);
      
      // Phase 2: Create shortlist
      const projectShortlist = createProjectShortlist(projectScores, roleLimit);
      
      // Phase 3: Bullet selection
      const selectedBullets = selectBullets(
        jobVector,
        bullets,
        projectShortlist,
        maxPerProject,
        roleLimit,
        weights,
        startTime
      );
      
      const processingTime = Date.now() - startTime;
      recordVectorOperation(processingTime, true, false);
      
      return {
        projectScores: projectScores.slice(0, projectShortlist.length),
        selectedBullets,
        processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      recordVectorOperation(processingTime, false, isTimeout);
      
      throw new Error(`Recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // Algorithm Validation
  // ============================================================================
  
  /**
   * Validate algorithm inputs
   */
  export function validateRecommendationInputs(
    jobVector: Float32Array,
    projects: ProjectData[],
    bullets: BulletData[],
    roleLimit: number,
    maxPerProject: number,
    weights: AlgorithmWeights
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate job vector
    if (!jobVector || jobVector.length === 0) {
      errors.push('Job vector is required and must not be empty');
    }
    
    // Validate projects
    if (!projects || projects.length === 0) {
      errors.push('At least one project is required');
    } else {
      for (const project of projects) {
        if (!project.id) {
          errors.push('All projects must have an ID');
        }
        if (!project.centroidVector || project.centroidVector.length === 0) {
          errors.push(`Project ${project.id} missing centroid vector`);
        }
        if (project.centroidVector && jobVector && project.centroidVector.length !== jobVector.length) {
          errors.push(`Project ${project.id} vector dimension mismatch`);
        }
      }
    }
    
    // Validate bullets
    if (!bullets || bullets.length === 0) {
      errors.push('At least one bullet is required');
    } else {
      for (const bullet of bullets) {
        if (!bullet.id) {
          errors.push('All bullets must have an ID');
        }
        if (!bullet.projectId) {
          errors.push(`Bullet ${bullet.id} missing project ID`);
        }
        if (!bullet.vector || bullet.vector.length === 0) {
          errors.push(`Bullet ${bullet.id} missing vector`);
        }
        if (bullet.vector && jobVector && bullet.vector.length !== jobVector.length) {
          errors.push(`Bullet ${bullet.id} vector dimension mismatch`);
        }
      }
    }
    
    // Validate limits
    if (roleLimit <= 0) {
      errors.push('Role limit must be positive');
    }
    if (maxPerProject <= 0) {
      errors.push('Max per project must be positive');
    }
    
    // Validate weights
    if (!weights) {
      errors.push('Algorithm weights are required');
    } else {
      if (weights.relevance < 0 || weights.relevance > 1) {
        errors.push('Relevance weight must be between 0 and 1');
      }
      if (weights.quality < 0 || weights.quality > 1) {
        errors.push('Quality weight must be between 0 and 1');
      }
      if (weights.recency < 0 || weights.recency > 1) {
        errors.push('Recency weight must be between 0 and 1');
      }
      if (weights.redundancyPenalty < 0 || weights.redundancyPenalty > 1) {
        errors.push('Redundancy penalty must be between 0 and 1');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }