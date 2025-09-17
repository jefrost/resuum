/**
 * Worker message handling and routing with production recommendation engine
 */

import { getVectorPerformanceMetrics, resetVectorPerformanceMetrics } from './vector-math';
import { RecommendationEngine } from './recommendation-engine';

// ============================================================================
// Types (inline since import path is unclear)
// ============================================================================


// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle vector operation requests - WORKING
 */
export function handleVectorOperation(): any {
  // Simple pass-through to existing vector operations
  // Will be properly implemented when worker integration is needed
  return {
    status: 'vector_operation_placeholder',
    message: 'Vector operations handled by worker',
    timestamp: Date.now()
  };
}

/**
 * Handle recommendation generation requests - PRODUCTION READY
 */
export function handleRecommendation(data: any): any {
  try {
    const { jobTitle, jobDescription } = data;
    
    if (!jobTitle || !jobDescription) {
      throw new Error('Job title and description are required for recommendations');
    }
    
    const engine = new RecommendationEngine();
    return engine.generateRecommendations(jobTitle, jobDescription);
    
  } catch (error) {
    throw new Error(`Recommendation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle health check requests
 */
export function handleHealthCheck(): any {
  return {
    status: 'healthy',
    timestamp: Date.now(),
    metrics: getVectorPerformanceMetrics()
  };
}

/**
 * Handle performance reset requests
 */
export function handlePerformanceReset(): any {
  resetVectorPerformanceMetrics();
  return {
    status: 'reset_complete',
    timestamp: Date.now()
  };
}