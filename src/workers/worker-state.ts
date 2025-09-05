/**
 * Worker State Management
 * Handles worker processing state, performance monitoring, and lifecycle
 */

// ============================================================================
// Worker State Interface
// ============================================================================

export interface WorkerState {
    isProcessing: boolean;
    currentOperation: string | null;
    operationStartTime: number;
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    timeouts: number;
  }
  
  // ============================================================================
  // State Management
  // ============================================================================
  
  let workerState: WorkerState = {
    isProcessing: false,
    currentOperation: null,
    operationStartTime: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    timeouts: 0
  };
  
  /**
   * Get current worker state (read-only copy)
   */
  export function getWorkerState(): Readonly<WorkerState> {
    return { ...workerState };
  }
  
  /**
   * Check if worker is currently processing
   */
  export function isWorkerBusy(): boolean {
    return workerState.isProcessing;
  }
  
  /**
   * Get current operation info
   */
  export function getCurrentOperation(): {
    operation: string | null;
    duration: number;
  } {
    return {
      operation: workerState.currentOperation,
      duration: workerState.operationStartTime > 0 
        ? Date.now() - workerState.operationStartTime 
        : 0
    };
  }
  
  /**
   * Start operation tracking
   */
  export function startOperation(operationType: string): void {
    if (workerState.isProcessing) {
      throw new Error(`Worker busy with ${workerState.currentOperation}`);
    }
    
    workerState.isProcessing = true;
    workerState.currentOperation = operationType;
    workerState.operationStartTime = Date.now();
    workerState.totalOperations++;
  }
  
  /**
   * Complete operation tracking
   */
  export function completeOperation(success: boolean, timeout: boolean = false): void {
    
    if (success) {
      workerState.successfulOperations++;
    } else {
      workerState.failedOperations++;
    }
    
    if (timeout) {
      workerState.timeouts++;
    }
    
    // Reset operation state
    workerState.isProcessing = false;
    workerState.currentOperation = null;
    workerState.operationStartTime = 0;
  }
  
  /**
   * Force reset operation state (for error recovery)
   */
  export function resetOperationState(): void {
    workerState.isProcessing = false;
    workerState.currentOperation = null;
    workerState.operationStartTime = 0;
  }
  
  /**
   * Reset all performance counters
   */
  export function resetPerformanceCounters(): void {
    workerState.totalOperations = 0;
    workerState.successfulOperations = 0;
    workerState.failedOperations = 0;
    workerState.timeouts = 0;
  }
  
  // ============================================================================
  // Performance Monitoring
  // ============================================================================
  
  /**
   * Get performance statistics
   */
  export function getPerformanceStats(): {
    totalOperations: number;
    successRate: number;
    timeoutRate: number;
    averageSuccessTime: number;
  } {
    const { totalOperations, successfulOperations, timeouts } = workerState;
    
    return {
      totalOperations,
      successRate: totalOperations > 0 ? successfulOperations / totalOperations : 0,
      timeoutRate: totalOperations > 0 ? timeouts / totalOperations : 0,
      averageSuccessTime: 0 // Could track if needed
    };
  }
  
  /**
   * Check if operation has exceeded timeout
   */
  export function checkOperationTimeout(timeoutMs: number): boolean {
    if (!workerState.isProcessing || workerState.operationStartTime === 0) {
      return false;
    }
    
    const elapsed = Date.now() - workerState.operationStartTime;
    return elapsed > timeoutMs;
  }
  
  /**
   * Get operation health status
   */
  export function getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    uptime: number;
  } {
    const issues: string[] = [];
    const stats = getPerformanceStats();
    
    // Check for high timeout rate
    if (stats.timeoutRate > 0.1) { // 10% timeout threshold
      issues.push(`High timeout rate: ${(stats.timeoutRate * 100).toFixed(1)}%`);
    }
    
    // Check for low success rate
    if (stats.successRate < 0.9 && stats.totalOperations > 10) {
      issues.push(`Low success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    }
    
    // Check for stuck operation
    if (workerState.isProcessing) {
      const duration = Date.now() - workerState.operationStartTime;
      if (duration > 10000) { // 10 second stuck threshold
        issues.push(`Operation stuck for ${Math.round(duration / 1000)}s`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      uptime: Date.now() // Could track actual start time if needed
    };
  }
  
  // ============================================================================
  // Error Handling Utilities
  // ============================================================================
  
  /**
   * Handle operation error with proper state cleanup
   */
  export function handleOperationError(error: Error, timeout: boolean = false): {
    shouldRestart: boolean;
    errorMessage: string;
  } {
    completeOperation(false, timeout);
    
    const stats = getPerformanceStats();
    const shouldRestart = (
      stats.timeoutRate > 0.5 || // More than 50% timeouts
      (stats.successRate < 0.5 && stats.totalOperations > 5) // Low success rate
    );
    
    return {
      shouldRestart,
      errorMessage: error.message || 'Unknown error'
    };
  }
  
  /**
   * Prepare worker for shutdown
   */
  export function prepareForShutdown(): {
    pendingOperations: boolean;
    forcedShutdown: boolean;
  } {
    const pendingOperations = workerState.isProcessing;
    
    if (pendingOperations) {
      // Force complete any pending operation
      completeOperation(false, true);
    }
    
    return {
      pendingOperations,
      forcedShutdown: pendingOperations
    };
  }
  
  // ============================================================================
  // Development/Debug Utilities
  // ============================================================================
  
  /**
   * Get detailed state information for debugging
   */
  export function getDebugInfo(): {
    state: WorkerState;
    performance: ReturnType<typeof getPerformanceStats>;
    health: ReturnType<typeof getHealthStatus>;
    memory?: any;
  } {
    return {
      state: getWorkerState(),
      performance: getPerformanceStats(),
      health: getHealthStatus(),
      memory: (performance as any).memory || null
    };
  }
  
  /**
   * Simulate operation for testing
   */
  export function simulateOperation(
    operationType: string,
    durationMs: number,
    shouldSucceed: boolean = true
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        startOperation(operationType);
        
        setTimeout(() => {
          try {
            completeOperation(shouldSucceed, false);
            if (shouldSucceed) {
              resolve();
            } else {
              reject(new Error('Simulated operation failure'));
            }
          } catch (error) {
            reject(error);
          }
        }, durationMs);
        
      } catch (error) {
        reject(error);
      }
    });
  }