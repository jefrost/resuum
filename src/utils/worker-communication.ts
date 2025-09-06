/**
 * Worker communication protocol and message routing
 */

import type { 
    VectorOperationData, 
    AlgorithmWeights,
    FunctionBias 
  } from '../types';
  
  // ============================================================================
  // Worker Message Types
  // ============================================================================
  
  export interface WorkerMessage {
    type: 'vector_operation' | 'recommendation' | 'health_check' | 'performance_reset';
    id: string;
    data: any;
  }
  
  export interface WorkerResponse {
    type: string;
    id: string;
    success: boolean;
    data?: any;
    error?: string;
    processingTime: number;
  }
  
  // ============================================================================
  // Algorithm Configuration
  // ============================================================================
  
  export const ALGORITHM_WEIGHTS: Record<FunctionBias, AlgorithmWeights> = {
    general: {
      relevance: 0.80,
      quality: 0.15,
      recency: 0.05,
      redundancy: 0.30
    },
    technical: {
      relevance: 0.85,
      quality: 0.20,
      recency: 0.05,
      redundancy: 0.30
    },
    business_strategy: {
      relevance: 0.80,
      quality: 0.20,
      recency: 0.05,
      redundancy: 0.35
    },
    marketing: {
      relevance: 0.78,
      quality: 0.20,
      recency: 0.05,
      redundancy: 0.30
    },
    operations: {
      relevance: 0.80,
      quality: 0.15,
      recency: 0.10,
      redundancy: 0.30
    }
  };
  
  // ============================================================================
  // Quality Feature Scoring
  // ============================================================================
  
  export interface QualityFeatureWeights {
    hasNumbers: number;
    actionVerb: number;
    lengthOk: number;
    maxBonus: number;
  }
  
  export const QUALITY_WEIGHTS: QualityFeatureWeights = {
    hasNumbers: 0.20,
    actionVerb: 0.10,
    lengthOk: 0.05,
    maxBonus: 0.35
  };
  
  // ============================================================================
  // Message Validation
  // ============================================================================
  
  export function validateWorkerMessage(message: any): message is WorkerMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.id === 'string' &&
      message.data !== undefined
    );
  }
  
  export function validateVectorOperation(data: any): data is VectorOperationData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.operation === 'string' &&
      Array.isArray(data.vectors)
    );
  }
  
  // ============================================================================
  // Response Helpers
  // ============================================================================
  
  export function createSuccessResponse(
    type: string,
    id: string,
    data: any,
    processingTime: number
  ): WorkerResponse {
    return {
      type,
      id,
      success: true,
      data,
      processingTime
    };
  }
  
  export function createErrorResponse(
    type: string,
    id: string,
    error: string,
    processingTime: number = 0
  ): WorkerResponse {
    return {
      type,
      id,
      success: false,
      error,
      processingTime
    };
  }
  
  // ============================================================================
  // Vector Operation Results
  // ============================================================================
  
  export interface SimilarityResult {
    similarities: number[];
    processingTime: number;
  }
  
  export interface RedundancyResult {
    redundancyScores: number[];
    processingTime: number;
  }
  
  export interface MMRResult {
    selectedIndices: number[];
    scores: number[];
    processingTime: number;
  }
  
  // ============================================================================
  // Function Bias Application
  // ============================================================================
  
  export function applyFunctionBias(bias: FunctionBias): AlgorithmWeights {
    const biasWeights = ALGORITHM_WEIGHTS[bias];
    
    return {
      relevance: biasWeights.relevance,
      quality: biasWeights.quality,
      recency: biasWeights.recency,
      redundancy: biasWeights.redundancy
    };
  }
  
  // ============================================================================
  // Quality Score Calculation
  // ============================================================================
  
  export function calculateQualityScore(features: {
    hasNumbers: boolean;
    actionVerb: boolean;
    lengthOk: boolean;
  }): number {
    let score = 0;
    
    if (features.hasNumbers) {
      score += QUALITY_WEIGHTS.hasNumbers;
    }
    
    if (features.actionVerb) {
      score += QUALITY_WEIGHTS.actionVerb;
    }
    
    if (features.lengthOk) {
      score += QUALITY_WEIGHTS.lengthOk;
    }
    
    // Cap at maximum bonus
    return Math.min(score, QUALITY_WEIGHTS.maxBonus);
  }
  
  // ============================================================================
  // Recency Scoring
  // ============================================================================
  
  export function calculateRecencyScore(roleOrderIndex: number, maxOrderIndex: number): number {
    if (maxOrderIndex === 0) {
      return 1.0; // Single role
    }
    
    // Linear decay: most recent (index 0) = 1.0, oldest = 0.5
    const normalizedIndex = roleOrderIndex / maxOrderIndex;
    return 1.0 - (normalizedIndex * 0.5);
  }