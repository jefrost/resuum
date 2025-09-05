/**
 * Worker Manager - Handles worker deployment, crash recovery, and timeout monitoring
 */

import type { WorkerMessage, WorkerResponse } from '../types';

// ============================================================================
// Constants and Configuration
// ============================================================================

const RESTART_DELAY_BASE = 200; // Base delay for exponential backoff
const MAX_RESTART_ATTEMPTS = 1; // Auto-restart once as specified
const HEALTH_CHECK_INTERVAL = 30000; // 30s health check
const MESSAGE_TIMEOUT = 5000; // 5s timeout for individual messages

interface WorkerManagerConfig {
  workerScript?: string | undefined;
  enableHealthChecks?: boolean;
  enableCrashRecovery?: boolean;
  maxConcurrentOperations?: number;
}

interface PendingMessage {
  id: string;
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: number;
  timestamp: number;
  operation: string;
}

// ============================================================================
// Worker Manager Class
// ============================================================================

export class WorkerManager {
  private worker: Worker | null = null;
  private workerScript: string | null = null;
  private pendingMessages = new Map<string, PendingMessage>();
  private restartAttempts = 0;
  private isHealthy = true;
  private lastHealthCheck = 0;
  private healthCheckTimer: number | null = null;
  private messageIdCounter = 0;
  
  private readonly config: Required<WorkerManagerConfig>;
  
  constructor(config: WorkerManagerConfig = {}) {
    this.config = {
      workerScript: undefined,
      enableHealthChecks: true,
      enableCrashRecovery: true,
      maxConcurrentOperations: 3,
      ...config
    };
  }
  
  // ============================================================================
  // Worker Deployment Options
  // ============================================================================
  
  /**
   * Initialize worker with automatic deployment option detection
   */
  async initialize(workerCode?: string): Promise<void> {
    try {
      // Attempt Blob worker first (default)
      if (workerCode) {
        await this.createBlobWorker(workerCode);
        console.log('Worker deployed using Blob (inline mode)');
        return;
      }
      
      // Fallback to separate worker file
      if (this.config.workerScript) {
        await this.createFileWorker(this.config.workerScript);
        console.log('Worker deployed using separate file');
        return;
      }
      
      throw new Error('No worker deployment option available');
      
    } catch (error) {
      console.error('Worker initialization failed:', error);
      throw new Error(`Worker deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create worker from Blob (inline deployment)
   */
  private async createBlobWorker(workerCode: string): Promise<void> {
    try {
      // Feature detection for Blob workers
      if (!('Blob' in globalThis) || !('URL' in globalThis) || !globalThis.URL.createObjectURL) {
        throw new Error('Blob workers not supported');
      }
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.workerScript = workerUrl;
      
      await this.setupWorker();
      
      // Cleanup blob URL after worker is ready
      setTimeout(() => {
        URL.revokeObjectURL(workerUrl);
      }, 1000);
      
    } catch (error) {
      throw new Error(`Blob worker creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create worker from separate file
   */
  private async createFileWorker(scriptPath: string): Promise<void> {
    try {
      this.worker = new Worker(scriptPath);
      this.workerScript = scriptPath;
      
      await this.setupWorker();
      
    } catch (error) {
      throw new Error(`File worker creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Setup worker event handlers and health monitoring
   */
  private async setupWorker(): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not created');
    }
    
    // Message handler
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };
    
    // Error handler - detect crashes
    this.worker.onerror = (error) => {
      console.error('Worker error detected:', error);
      this.handleWorkerCrash(new Error(`Worker error: ${error instanceof ErrorEvent ? error.message : 'Unknown error'}`));
    };
    
    // Termination handler
    this.worker.onmessageerror = (error) => {
      console.error('Worker message error:', error);
      this.handleWorkerCrash(new Error('Worker message error'));
    };
    
    // Initial health check
    await this.performHealthCheck();
    
    // Start periodic health checks
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    console.log('Worker setup completed successfully');
  }
  
  // ============================================================================
  // Message Handling and Timeout Management
  // ============================================================================
  
  /**
   * Send message to worker with timeout handling
   */
  async sendMessage(type: string, data: any, timeoutMs: number = MESSAGE_TIMEOUT): Promise<WorkerResponse> {
    if (!this.worker || !this.isHealthy) {
      if (this.config.enableCrashRecovery && this.canRestart()) {
        await this.restartWorker();
      } else {
        throw new Error('Worker not available');
      }
    }
    
    // Check concurrent operations limit
    if (this.pendingMessages.size >= this.config.maxConcurrentOperations) {
      throw new Error(`Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`);
    }
    
    const messageId = this.generateMessageId();
    const message: WorkerMessage = {
      type,
      id: messageId,
      data
    };
    
    return new Promise<WorkerResponse>((resolve, reject) => {
      // Store pending message
      const pending: PendingMessage = {
        id: messageId,
        resolve,
        reject,
        timeout: Date.now() + timeoutMs,
        timestamp: Date.now(),
        operation: type
      };
      
      this.pendingMessages.set(messageId, pending);
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.handleMessageTimeout(messageId);
      }, timeoutMs);
      
      // Send message
      try {
        this.worker!.postMessage(message);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingMessages.delete(messageId);
        reject(new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }
  
  /**
   * Handle worker response messages
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingMessages.get(response.id);
    
    if (!pending) {
      console.warn(`Received response for unknown message ID: ${response.id}`);
      return;
    }
    
    this.pendingMessages.delete(response.id);
    
    if (response.success) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.error || 'Unknown worker error'));
    }
  }
  
  /**
   * Handle message timeout
   */
  private handleMessageTimeout(messageId: string): void {
    const pending = this.pendingMessages.get(messageId);
    
    if (pending) {
      this.pendingMessages.delete(messageId);
      pending.reject(new Error(`Operation timeout after ${MESSAGE_TIMEOUT}ms: ${pending.operation}`));
      
      // Consider restarting worker if too many timeouts
      if (this.pendingMessages.size === 0) {
        console.warn('Worker timeout detected, considering restart');
        if (this.config.enableCrashRecovery && this.canRestart()) {
          this.restartWorker().catch(console.error);
        }
      }
    }
  }
  
  // ============================================================================
  // Crash Detection and Recovery
  // ============================================================================
  
  /**
   * Handle worker crash
   */
  private handleWorkerCrash(error: Error): void {
    console.error('Worker crash detected:', error);
    
    this.isHealthy = false;
    
    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      pending.reject(new Error(`Worker crashed: ${error.message}`));
    }
    this.pendingMessages.clear();
    
    // Attempt restart if enabled
    if (this.config.enableCrashRecovery && this.canRestart()) {
      console.log('Attempting worker restart...');
      this.restartWorker().catch(console.error);
    }
  }
  
  /**
   * Check if worker can be restarted
   */
  private canRestart(): boolean {
    return this.restartAttempts < MAX_RESTART_ATTEMPTS;
  }
  
  /**
   * Restart worker with exponential backoff
   */
  private async restartWorker(): Promise<void> {
    if (!this.canRestart()) {
      throw new Error('Maximum restart attempts exceeded');
    }
    
    this.restartAttempts++;
    
    // Calculate backoff delay
    const delay = RESTART_DELAY_BASE * Math.pow(2, this.restartAttempts - 1);
    
    console.log(`Restarting worker in ${delay}ms (attempt ${this.restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Terminate old worker
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      
      // Create new worker (reuse deployment method)
      if (this.workerScript) {
        if (this.workerScript.startsWith('blob:')) {
          // Cannot restart Blob worker - need original code
          throw new Error('Cannot restart Blob worker without original code');
        } else {
          await this.createFileWorker(this.workerScript);
        }
      }
      
      this.isHealthy = true;
      console.log('Worker restarted successfully');
      
    } catch (error) {
      console.error('Worker restart failed:', error);
      throw error;
    }
  }
  
  // ============================================================================
  // Health Monitoring
  // ============================================================================
  
  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const response = await this.sendMessage('health_check', {}, 2000);
      
      this.isHealthy = response.success;
      this.lastHealthCheck = Date.now();
      
      if (this.isHealthy) {
        // Reset restart attempts on successful health check
        this.restartAttempts = 0;
      }
      
      return this.isHealthy;
      
    } catch (error) {
      console.warn('Health check failed:', error);
      this.isHealthy = false;
      return false;
    }
  }
  
  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch(console.error);
    }, HEALTH_CHECK_INTERVAL) as unknown as number;
  }
  
  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  // ============================================================================
  // Public API Methods
  // ============================================================================
  
  /**
   * Get worker status and performance metrics
   */
  getStatus(): {
    isHealthy: boolean;
    pendingOperations: number;
    restartAttempts: number;
    lastHealthCheck: number;
  } {
    return {
      isHealthy: this.isHealthy,
      pendingOperations: this.pendingMessages.size,
      restartAttempts: this.restartAttempts,
      lastHealthCheck: this.lastHealthCheck
    };
  }
  
  /**
   * Terminate worker and cleanup resources
   */
  terminate(): void {
    // Stop health checks
    this.stopHealthChecks();
    
    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    // Cleanup blob URL if applicable
    if (this.workerScript && this.workerScript.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(this.workerScript);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Reject pending messages
    for (const [, pending] of this.pendingMessages) {
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingMessages.clear();
    
    // Reset state
    this.isHealthy = false;
    this.restartAttempts = 0;
    this.lastHealthCheck = 0;
    this.workerScript = null;
    
    console.log('Worker manager terminated and cleaned up');
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }
}