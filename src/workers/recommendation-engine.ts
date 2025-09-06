/**
 * Production recommendation engine with project-first algorithm
 */

import { cosineSimilarity, calculateRedundancyScores } from './vector-math';
import { executeTransaction } from '../storage/transactions';
import { ALGORITHM_WEIGHTS } from '../utils/worker-communication';
import type { 
  Role, 
  Project, 
  Bullet, 
  Embedding,
  JobAnalysis,
  RecommendationResult,
  RoleResult,
  BulletScore,
  ProjectScore,
  FunctionBias,
  AlgorithmWeights
} from '../types';

// ============================================================================
// Algorithm Configuration
// ============================================================================

const ALGORITHM_CONFIG = {
  MIN_PROJECTS_PER_ROLE: 3,
  MAX_PROJECTS_PER_ROLE: 8,
  PROJECT_MULTIPLIER: 2,
  MAX_PER_PROJECT: 1, // Hard constraint for MVP
  REDUNDANCY_THRESHOLD: 0.85,
  QUALITY_BONUS_CAP: 0.35
};

// ============================================================================
// Recommendation Engine Class
// ============================================================================

export class RecommendationEngine {
  /**
   * Generate recommendations for a job description
   */
  async generateRecommendations(
    jobAnalysis: JobAnalysis,
    functionBias: FunctionBias = 'general'
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    
    try {
      // Get algorithm weights with function bias
      const weights = this.applyFunctionBias(functionBias);
      
      // Get all data needed for recommendations
      const { roles, projects, bullets, embeddings } = await this.getAllData();
      
      if (!jobAnalysis.embedding) {
        throw new Error('Job description embedding is required');
      }
      
      // Process each role
      const roleResults: RoleResult[] = [];
      let totalBullets = 0;
      let totalProjects = 0;
      
      for (const role of roles) {
        const roleResult = await this.processRole(
          role,
          projects,
          bullets,
          embeddings,
          jobAnalysis.embedding,
          weights
        );
        
        if (roleResult.selectedBullets.length > 0) {
          roleResults.push(roleResult);
          totalBullets += roleResult.selectedBullets.length;
          totalProjects += roleResult.projectsConsidered.length;
        }
      }
      
      return {
        jobTitle: jobAnalysis.title,
        totalBullets,
        processingTime: Date.now() - startTime,
        projectsConsidered: totalProjects,
        roleResults
      };
      
    } catch (error) {
      throw new Error(`Recommendation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // Role Processing
  // ============================================================================
  
  /**
   * Process a single role for recommendations
   */
  private async processRole(
    role: Role,
    allProjects: Project[],
    allBullets: Bullet[],
    allEmbeddings: Embedding[],
    jobEmbedding: Float32Array,
    weights: AlgorithmWeights
  ): Promise<RoleResult> {
    // Get projects for this role
    const roleProjects = allProjects.filter(p => p.roleId === role.id);
    const roleBullets = allBullets.filter(b => b.roleId === role.id && b.embeddingState === 'ready');
    
    if (roleProjects.length === 0 || roleBullets.length === 0) {
      return {
        roleId: role.id,
        roleTitle: `${role.title} (${role.company})`,
        selectedBullets: [],
        projectsConsidered: [],
        avgRelevance: 0
      };
    }
    
    // Phase 1: Rank projects by centroid similarity
    const projectScores = await this.rankProjects(roleProjects, jobEmbedding, weights, role.orderIndex);
    
    // Phase 2: Shortlist top projects
    const shortlistedProjects = this.shortlistProjects(projectScores, role.bulletsLimit);
    
    // Phase 3: Select best bullets from shortlisted projects
    const selectedBullets = await this.selectBullets(
      shortlistedProjects,
      roleBullets,
      allEmbeddings,
      jobEmbedding,
      weights,
      role.bulletsLimit
    );
    
    // Calculate average relevance
    const avgRelevance = selectedBullets.length > 0 
      ? selectedBullets.reduce((sum, b) => sum + b.relevanceScore, 0) / selectedBullets.length
      : 0;
    
    return {
      roleId: role.id,
      roleTitle: `${role.title} (${role.company})`,
      selectedBullets,
      projectsConsidered: shortlistedProjects.map(p => p.projectId),
      avgRelevance
    };
  }
  
  // ============================================================================
  // Project Ranking
  // ============================================================================
  
  /**
   * Rank projects by centroid similarity to job description
   */
  private async rankProjects(
    projects: Project[],
    jobEmbedding: Float32Array,
    weights: AlgorithmWeights,
    roleOrderIndex: number
  ): Promise<ProjectScore[]> {
    const scores: ProjectScore[] = [];
    
    for (const project of projects) {
      if (project.centroidVector.byteLength === 0) {
        continue; // Skip projects without centroids
      }
      
      try {
        const centroid = new Float32Array(project.centroidVector);
        const relevanceScore = cosineSimilarity(jobEmbedding, centroid);
        
        // Calculate recency score (more recent roles score higher)
        const recencyScore = 1.0 - (roleOrderIndex * 0.1); // 10% decay per role position
        
        // Combined score
        const score = 
          weights.relevance * relevanceScore + 
          weights.recency * Math.max(0.5, recencyScore); // Minimum 0.5 recency
        
        scores.push({
          projectId: project.id,
          score,
          relevanceScore,
          qualityScore: 0, // Not applicable at project level
          recencyScore
        });
        
      } catch (error) {
        console.warn(`Failed to score project ${project.id}:`, error);
      }
    }
    
    return scores.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Shortlist top projects per role
   */
  private shortlistProjects(projectScores: ProjectScore[], roleLimit: number): ProjectScore[] {
    const maxProjects = Math.min(
      projectScores.length,
      Math.max(
        ALGORITHM_CONFIG.MIN_PROJECTS_PER_ROLE,
        Math.min(
          ALGORITHM_CONFIG.MAX_PROJECTS_PER_ROLE,
          ALGORITHM_CONFIG.PROJECT_MULTIPLIER * roleLimit
        )
      )
    );
    
    return projectScores.slice(0, maxProjects);
  }
  
  // ============================================================================
  // Bullet Selection
  // ============================================================================
  
  /**
   * Select best bullets from shortlisted projects with anti-redundancy
   */
  private async selectBullets(
    shortlistedProjects: ProjectScore[],
    roleBullets: Bullet[],
    allEmbeddings: Embedding[],
    jobEmbedding: Float32Array,
    weights: AlgorithmWeights,
    roleLimit: number
  ): Promise<BulletScore[]> {
    const candidates: Array<{
      bullet: Bullet;
      embedding: Float32Array;
      projectId: string;
      score: number;
      relevanceScore: number;
      qualityScore: number;
    }> = [];
    
    // Phase 1: Score all bullets in shortlisted projects
    for (const projectScore of shortlistedProjects) {
      const projectBullets = roleBullets.filter(b => b.projectId === projectScore.projectId);
      
      for (const bullet of projectBullets) {
        const embedding = allEmbeddings.find(e => e.bulletId === bullet.id);
        if (!embedding) continue;
        
        try {
          const embeddingVector = new Float32Array(embedding.vector);
          const relevanceScore = cosineSimilarity(jobEmbedding, embeddingVector);
          const qualityScore = this.calculateQualityScore(bullet);
          
          const totalScore = 
            weights.relevance * relevanceScore + 
            weights.quality * qualityScore;
          
          candidates.push({
            bullet,
            embedding: embeddingVector,
            projectId: projectScore.projectId,
            score: totalScore,
            relevanceScore,
            qualityScore
          });
          
        } catch (error) {
          console.warn(`Failed to score bullet ${bullet.id}:`, error);
        }
      }
    }
    
    // Phase 2: Select with constraints and anti-redundancy
    return this.selectWithConstraints(candidates, roleLimit, weights.redundancy);
  }
  
  /**
   * Select bullets with project constraints and anti-redundancy
   */
  private selectWithConstraints(
    candidates: Array<{
      bullet: Bullet;
      embedding: Float32Array;
      projectId: string;
      score: number;
      relevanceScore: number;
      qualityScore: number;
    }>,
    roleLimit: number,
    redundancyWeight: number
  ): BulletScore[] {
    const selected: BulletScore[] = [];
    const selectedEmbeddings: Float32Array[] = [];
    const projectCounts = new Map<string, number>();
    
    // Sort candidates by score
    const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
    
    for (const candidate of sortedCandidates) {
      if (selected.length >= roleLimit) break;
      
      // Check project constraint (max 1 per project)
      const currentCount = projectCounts.get(candidate.projectId) || 0;
      if (currentCount >= ALGORITHM_CONFIG.MAX_PER_PROJECT) {
        continue;
      }
      
      // Check redundancy
      let redundancyPenalty = 0;
      if (selectedEmbeddings.length > 0) {
        const redundancyScores = calculateRedundancyScores(
          [candidate.embedding],
          selectedEmbeddings,
          Date.now()
        );
        redundancyPenalty = redundancyScores[0] || 0;
        
        // Skip if too similar to existing selections
        if (redundancyPenalty >= ALGORITHM_CONFIG.REDUNDANCY_THRESHOLD) {
          continue;
        }
      }
      
      // Apply redundancy penalty to final score
      const finalScore = candidate.score - (redundancyWeight * redundancyPenalty);
      
      selected.push({
        bulletId: candidate.bullet.id,
        score: finalScore,
        relevanceScore: candidate.relevanceScore,
        qualityScore: candidate.qualityScore,
        redundancyPenalty
      });
      
      selectedEmbeddings.push(candidate.embedding);
      projectCounts.set(candidate.projectId, currentCount + 1);
    }
    
    return selected;
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Calculate quality score for a bullet point
   */
  private calculateQualityScore(bullet: Bullet): number {
    let score = 0;
    
    if (bullet.features.hasNumbers) {
      score += 0.20;
    }
    
    if (bullet.features.actionVerb) {
      score += 0.10;
    }
    
    if (bullet.features.lengthOk) {
      score += 0.05;
    }
    
    return Math.min(score, ALGORITHM_CONFIG.QUALITY_BONUS_CAP);
  }
  
  /**
   * Apply function bias to algorithm weights
   */
  private applyFunctionBias(bias: FunctionBias): AlgorithmWeights {
    return ALGORITHM_WEIGHTS[bias];
  }
  
  /**
   * Get all data needed for recommendations
   */
  private async getAllData(): Promise<{
    roles: Role[];
    projects: Project[];
    bullets: Bullet[];
    embeddings: Embedding[];
  }> {
    return executeTransaction(['roles', 'projects', 'bullets', 'embeddings'], 'readonly', async (_, stores) => {
      const [roles, projects, bullets, embeddings] = await Promise.all([
        this.getAll<Role>(stores.roles),
        this.getAll<Project>(stores.projects),
        this.getAll<Bullet>(stores.bullets),
        this.getAll<Embedding>(stores.embeddings)
      ]);
      
      return { roles, projects, bullets, embeddings };
    });
  }
  
  /**
   * Helper to get all records from a store
   */
  private getAll<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// Global Engine Instance
// ============================================================================

let globalEngine: RecommendationEngine | null = null;

/**
 * Get global recommendation engine (singleton)
 */
export function getRecommendationEngine(): RecommendationEngine {
  if (!globalEngine) {
    globalEngine = new RecommendationEngine();
  }
  return globalEngine;
}

/**
 * Reset engine instance (for testing)
 */
export function resetRecommendationEngine(): void {
  globalEngine = null;
}