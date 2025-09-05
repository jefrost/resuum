/**
 * Worker Message Handler
 * Handles message routing, validation, and response formatting
 */

import { 
    batchCosineSimilarity,
    calculateRedundancyScores,
    getVectorPerformanceMetrics,
    resetVectorPerformanceMetrics
  } from './vector-math';
  
  import { 
    generateRecommendations,
    validateRecommendationInputs,
    TIMING_BUDGETS,
    type AlgorithmWeights,
    type ProjectData,
    type BulletData
  } from './recommendation-algorithm';
  
  // ============================================================================
  // Message Types
  // ============================================================================
  
  export interface WorkerMessage {
    type: string;
    id: string;
    data: any;
    timestamp?: number;
  }
  
  export interface WorkerResponse {
    type: string;
    id: string;
    success: boolean;
    data?: any;
    error?: string;
    processingTime?: number;
  }
  
  interface VectorOperation {
    jobVector: Float32Array;
    bulletVectors: Float32Array[];
    selectedVectors?: Float32Array[];
    weights?: AlgorithmWeights;
  }
  
  interface RecommendationRequest {
    jobVector: Float32Array;
    projects: ProjectData[];
    bullets: BulletData[];
    maxPerProject: number;
    roleLimit: number;
    weights: AlgorithmWeights;
  }
  
  // ============================================================================
  // Individual Message Handlers
  // ============================================================================
  
  /**
   * Handle vector operation requests
   */
  export function handleVectorOperation(data: VectorOperation): any {
    const startTime = Date.now();
    
    if (!data.jobVector || !data.bulletVectors) {
      throw new Error('Missing required vectors for operation');
    }
    
    try {
      const similarities = batchCosineSimilarity(
        data.jobVector,
        data.bulletVectors,
        startTime,
        TIMING_BUDGETS.VECTOR_OPERATION
      );
      
      const redundancyScores = calculateRedundancyScores(
        data.bulletVectors,
        data.selectedVectors || [],
        startTime,
        TIMING_BUDGETS.VECTOR_OPERATION
      );
      
      return {
        similarities,
        redundancyScores,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Vector operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle recommendation generation requests
   */
  export function handleRecommendation(data: RecommendationRequest): any {
    // Validate inputs first
    const validation = validateRecommendationInputs(
      data.jobVector,
      data.projects,
      data.bullets,
      data.roleLimit,
      data.maxPerProject,
      data.weights
    );
    
    if (!validation.isValid) {
      throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Generate recommendations using algorithm module
    return generateRecommendations(
      data.jobVector,
      data.projects,
      data.bullets,
      data.roleLimit,
      data.maxPerProject,
      data.weights
    );
  }
  
  /**
   * Handle health check requests
   */
  export function handleHealthCheck(): any {
    const metrics = getVectorPerformanceMetrics();
    
    return {
      status: 'healthy',
      timestamp: Date.now(),
      capabilities: ['vector_operation', 'recommendation', 'performance_reset'],
      performance: metrics,
      memoryUsage: {
        used: (performance as any).memory?.usedJSHeapSize || 0,
        total: (performance as any).memory?.totalJSHeapSize || 0
      }
    };
  }
  
  /**
   * Handle performance reset requests
   */
  export function handlePerformanceReset(): any {
    resetVectorPerformanceMetrics();
    
    return {
      status: 'reset',
      timestamp: Date.now(),
      message: 'Performance metrics reset successfully'
    };
  }
  
  // ============================================================================
  // Message Router
  // ============================================================================
  
  /**
   * Route message to appropriate handler
   */
  export function routeMessage(message: WorkerMessage): any {
    switch (message.type) {
      case 'vector_operation':
        return handleVectorOperation(message.data);
        
      case 'recommendation':
        return handleRecommendation(message.data);
        
      case 'health_check':
        return handleHealthCheck();
        
      case 'performance_reset':
        return handlePerformanceReset();
        
      default:
        throw new Error(`Unknown operation type: ${message.type}`);
    }
  }
  
  /**
   * Validate message structure
   */
  export function validateMessage(message: any): message is WorkerMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.id === 'string' &&
      message.data !== undefined
    );
  }
  
  /**
   * Create success response
   */
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
  
  /**
   * Create error response with proper optional property handling
   */
  export function createErrorResponse(
    type: string,
    id: string,
    error: string,
    processingTime?: number
  ): WorkerResponse {
    const response: WorkerResponse = {
      type,
      id,
      success: false,
      error
    };
    
    // Only add processingTime if it's defined
    if (processingTime !== undefined) {
      response.processingTime = processingTime;
    }
    
    return response;
  }