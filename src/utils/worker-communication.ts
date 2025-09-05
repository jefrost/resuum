/**
 * Worker Communication - High-level API for worker interactions
 */

import { WorkerManager } from './worker-manager';
import type { 
  VectorOperation, 
  VectorResult,
  AlgorithmWeights,
  FunctionBias 
} from '../types';

// ============================================================================
// Communication Protocol Types
// ============================================================================

interface ProjectRankingRequest {
  jobVector: Float32Array;
  projects: Array<{
    id: string;
    centroidVector: Float32Array;
    recencyFactor: number;
  }>;
  weights: AlgorithmWeights;
}

interface BulletSelectionRequest {
  jobVector: Float32Array;
  bullets: Array<{
    id: string;
    projectId: string;
    vector: Float32Array;
    qualityFeatures: {
      hasNumbers: boolean;
      actionVerb: boolean;
      lengthOk: boolean;
    };
  }>;
  projectShortlist: string[];
  maxPerProject: number;
  roleLimit: number;
  weights: AlgorithmWeights;
}

interface RecommendationRequest extends ProjectRankingRequest {
  bullets: BulletSelectionRequest['bullets'];
  maxPerProject: number;
  roleLimit: number;
}

interface RecommendationResult {
  projectScores: Array<{
    projectId: string;
    score: number;
    similarity: number;
    recencyFactor: number;
  }>;
  selectedBullets: Array<{
    bulletId: string;
    score: number;
    relevance: number;
    qualityScore: number;
    redundancyScore: number;
  }>;
  processingTime: number;
}

// ============================================================================
// Function Bias Weight Maps
// ============================================================================

const FUNCTION_BIAS_WEIGHTS: Record<FunctionBias, AlgorithmWeights> = {
  general: {
    relevance: 0.80,
    quality: 0.15,
    recency: 0.05,
    redundancyPenalty: 0.30
  },
  technical: {
    relevance: 0.85, // α +0.05
    quality: 0.20,   // μ +0.05 (capped)
    recency: 0.05,
    redundancyPenalty: 0.30
  },
  business_strategy: {
    relevance: 0.80,
    quality: 0.20,   // μ +0.05
    recency: 0.05,
    redundancyPenalty: 0.35 // λ +0.05 (encourage diversity)
  },
  marketing: {
    relevance: 0.78, // α -0.02 (less keyword chasing)
    quality: 0.20,   // μ +0.05
    recency: 0.05,
    redundancyPenalty: 0.30
  },
  operations: {
    relevance: 0.80,
    quality: 0.15,
    recency: 0.10,   // ρ +0.05 (mild recency bump)
    redundancyPenalty: 0.30
  }
};

// ============================================================================
// Worker Communication Class
// ============================================================================

export class WorkerCommunication {
  private workerManager: WorkerManager;
  private isInitialized = false;
  
  constructor() {
    this.workerManager = new WorkerManager({
      enableHealthChecks: true,
      enableCrashRecovery: true,
      maxConcurrentOperations: 3
    });
  }
  
  // ============================================================================
  // Initialization
  // ============================================================================
  
  /**
   * Initialize worker communication
   */
  async initialize(workerCode?: string): Promise<void> {
    try {
      await this.workerManager.initialize(workerCode);
      this.isInitialized = true;
      console.log('Worker communication initialized successfully');
    } catch (error) {
      console.error('Worker communication initialization failed:', error);
      throw new Error(`Failed to initialize worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.workerManager.getStatus().isHealthy;
  }
  
  // ============================================================================
  // Vector Operations
  // ============================================================================
  
  /**
   * Calculate cosine similarities between job vector and bullet vectors
   */
  async calculateSimilarities(
    jobVector: Float32Array,
    bulletVectors: Float32Array[],
    selectedVectors: Float32Array[] = []
  ): Promise<VectorResult> {
    this.ensureInitialized();
    
    try {
      const request: VectorOperation = {
        jobVector,
        bulletVectors,
        selectedVectors
      };
      
      const response = await this.workerManager.sendMessage(
        'vector_operation',
        request,
        2000 // 2s timeout for vector operations
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Vector operation failed');
      }
      
      return response.data as VectorResult;
      
    } catch (error) {
      console.error('Vector similarity calculation failed:', error);
      throw new Error(`Similarity calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // ============================================================================
  // Recommendation Generation
  // ============================================================================
  
  /**
   * Generate recommendations for a job description
   */
  async generateRecommendations(
    jobVector: Float32Array,
    projects: ProjectRankingRequest['projects'],
    bullets: BulletSelectionRequest['bullets'],
    roleLimit: number,
    maxPerProject: number = 1,
    functionBias: FunctionBias = 'general'
  ): Promise<RecommendationResult> {
    this.ensureInitialized();
    
    try {
      const weights = this.getWeightsForBias(functionBias);
      
      const request: RecommendationRequest = {
        jobVector,
        projects,
        bullets,
        maxPerProject,
        roleLimit,
        weights
      };
      
      const response = await this.workerManager.sendMessage(
        'recommendation',
        request,
        5000 // 5s timeout for full recommendation
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Recommendation generation failed');
      }
      
      return response.data as RecommendationResult;
      
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      
      // Check if it's a timeout error and provide helpful message
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('Recommendation generation timed out. Try reducing the number of bullets or simplifying the job description.');
      }
      
      throw new Error(`Recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Rank projects by relevance to job description
   */
  async rankProjects(
    jobVector: Float32Array,
    projects: ProjectRankingRequest['projects'],
    functionBias: FunctionBias = 'general'
  ): Promise<RecommendationResult['projectScores']> {
    const result = await this.generateRecommendations(
      jobVector,
      projects,
      [], // No bullets needed for project ranking only
      999, // High role limit
      1,
      functionBias
    );
    
    return result.projectScores;
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Get algorithm weights for function bias
   */
  private getWeightsForBias(bias: FunctionBias): AlgorithmWeights {
    return { ...FUNCTION_BIAS_WEIGHTS[bias] };
  }
  
  /**
   * Ensure worker is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Worker communication not initialized. Call initialize() first.');
    }
    
    if (!this.workerManager.getStatus().isHealthy) {
      throw new Error('Worker is not healthy. Check worker status.');
    }
  }
  
  /**
   * Get worker status and performance metrics
   */
  getStatus(): {
    isReady: boolean;
    isHealthy: boolean;
    pendingOperations: number;
    restartAttempts: number;
    lastHealthCheck: number;
  } {
    const status = this.workerManager.getStatus();
    
    return {
      isReady: this.isReady(),
      ...status
    };
  }
  
  /**
   * Perform manual health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }
    
    try {
      const response = await this.workerManager.sendMessage('health_check', {}, 2000);
      return response.success;
    } catch (error) {
      console.warn('Manual health check failed:', error);
      return false;
    }
  }
  
  /**
   * Terminate worker and cleanup resources
   */
  terminate(): void {
    if (this.workerManager) {
      this.workerManager.terminate();
      this.isInitialized = false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalWorkerCommunication: WorkerCommunication | null = null;

/**
 * Get global worker communication instance
 */
export function getWorkerCommunication(): WorkerCommunication {
  if (!globalWorkerCommunication) {
    globalWorkerCommunication = new WorkerCommunication();
  }
  return globalWorkerCommunication;
}

/**
 * Reset worker communication (for testing)
 */
export function resetWorkerCommunication(): void {
  if (globalWorkerCommunication) {
    globalWorkerCommunication.terminate();
    globalWorkerCommunication = null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Initialize worker with inline code or separate file
 */
export async function initializeWorker(workerCode?: string): Promise<void> {
  const comm = getWorkerCommunication();
  await comm.initialize(workerCode);
}

/**
 * Quick similarity calculation
 */
export async function calculateSimilarities(
  jobVector: Float32Array,
  bulletVectors: Float32Array[],
  selectedVectors: Float32Array[] = []
): Promise<VectorResult> {
  const comm = getWorkerCommunication();
  return comm.calculateSimilarities(jobVector, bulletVectors, selectedVectors);
}

/**
 * Quick recommendation generation
 */
export async function generateRecommendations(
  jobVector: Float32Array,
  projects: ProjectRankingRequest['projects'],
  bullets: BulletSelectionRequest['bullets'],
  roleLimit: number,
  functionBias: FunctionBias = 'general'
): Promise<RecommendationResult> {
  const comm = getWorkerCommunication();
  return comm.generateRecommendations(
    jobVector,
    projects,
    bullets,
    roleLimit,
    1, // maxPerProject
    functionBias
  );
}

/**
 * Check worker health
 */
export async function checkWorkerHealth(): Promise<boolean> {
  const comm = getWorkerCommunication();
  return comm.healthCheck();
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  const comm = getWorkerCommunication();
  return comm.getStatus();
}