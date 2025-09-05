/**
 * Resuum Recommendation Worker
 * Minimal coordinator that delegates to specialized modules
 */

import {
    validateMessage,
    routeMessage,
    createSuccessResponse,
    createErrorResponse,
    type WorkerResponse
  } from './worker-message-handler';
  
  import {
    isWorkerBusy,
    getCurrentOperation,
    startOperation,
    completeOperation,
    handleOperationError,
    prepareForShutdown
  } from './worker-state';
  
  // ============================================================================
  // Worker Communication
  // ============================================================================
  
  /**
   * Send response back to main thread
   */
  function sendResponse(response: WorkerResponse): void {
    try {
      self.postMessage(response);
    } catch (error) {
      console.error('Failed to send worker response:', error);
    }
  }
  
  /**
   * Main message handler
   */
  self.onmessage = function(event: MessageEvent) {
    const message = event.data;
    const startTime = Date.now();
    
    // Validate message structure
    if (!validateMessage(message)) {
      sendResponse(createErrorResponse('error', 'unknown', 'Invalid message format'));
      return;
    }
    
    // Check if worker is busy
    if (isWorkerBusy()) {
      const current = getCurrentOperation();
      sendResponse(createErrorResponse(
        message.type,
        message.id,
        `Worker busy with ${current.operation}`
      ));
      return;
    }
    
    try {
      // Start operation tracking
      startOperation(message.type);
      
      // Route message to appropriate handler
      const result = routeMessage(message);
      const processingTime = Date.now() - startTime;
      
      // Complete operation and send success response
      completeOperation(true);
      sendResponse(createSuccessResponse(message.type, message.id, result, processingTime));
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      
      // Handle error with proper state cleanup
      const errorInfo = handleOperationError(error as Error, isTimeout);
      
      sendResponse(createErrorResponse(
        message.type,
        message.id,
        errorInfo.errorMessage,
        processingTime
      ));
    }
  };
  
  /**
   * Handle worker errors with proper typing for OnErrorEventHandler
   */
  self.onerror = function(event: string | Event) {
    console.error('Worker error:', event);
    
    let errorMessage: string;
    
    if (typeof event === 'string') {
      errorMessage = event;
    } else if (event instanceof ErrorEvent) {
      errorMessage = event.message || 'Unknown worker error';
    } else {
      errorMessage = 'Unknown worker error';
    }
    
    sendResponse(createErrorResponse(
      'error', 
      'worker_error', 
      `Worker error: ${errorMessage}`
    ));
  };
  
  /**
   * Handle unhandled promise rejections
   */
  self.onunhandledrejection = function(event: PromiseRejectionEvent) {
    console.error('Worker unhandled rejection:', event.reason);
    
    sendResponse(createErrorResponse(
      'error',
      'unhandled_rejection',
      `Unhandled rejection: ${event.reason}`
    ));
  };
  
  /**
   * Handle worker termination
   */
  self.addEventListener('beforeunload', () => {
    const shutdown = prepareForShutdown();
    if (shutdown.forcedShutdown) {
      console.warn('Worker terminated with pending operations');
    }
  });
  
  // Initialize worker
  console.log('Resuum recommendation worker initialized with modular architecture');
  
  // Export for TypeScript
  export {};