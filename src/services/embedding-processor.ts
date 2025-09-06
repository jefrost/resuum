/**
 * Embedding queue processor with state machine integration
 */

import { getOpenAIService } from './openai-service';
import { getEmbeddingStateMachine } from '../storage/embedding-state';
import { executeTransaction, getById, create } from '../storage/transactions';
import { calculateCentroid } from '../workers/vector-math';
import { CURRENT_EMBEDDING_VERSION } from '../storage/schema';
import type { Bullet, Embedding, Project, EmbedQueueItem } from '../types';

// ============================================================================
// Configuration
// ============================================================================

const PROCESSOR_CONFIG = {
  BATCH_SIZE: 3, // Process 3 items concurrently
  POLL_INTERVAL: 2000, // Check queue every 2 seconds
  MAX_PROCESSING_TIME: 30000, // 30 second timeout per item
  AUTO_START: true // Start processing automatically
};

// ============================================================================
// Embedding Processor Class
// ============================================================================

export class EmbeddingProcessor {
  private isProcessing = false;
  private shouldStop = false;
  private currentBatch = new Set<string>();
  private processingStats = {
    processed: 0,
    failed: 0,
    startTime: Date.now()
  };

  /**
   * Start the embedding processor
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      console.warn('Embedding processor already running');
      return;
    }

    console.log('Starting embedding processor...');
    this.isProcessing = true;
    this.shouldStop = false;
    this.processingStats = {
      processed: 0,
      failed: 0,
      startTime: Date.now()
    };

    // Start processing loop
    this.processingLoop();
  }

  /**
   * Stop the embedding processor
   */
  async stop(): Promise<void> {
    console.log('Stopping embedding processor...');
    this.shouldStop = true;
    
    // Wait for current batch to complete
    const timeout = 5000; // 5 second timeout
    const startTime = Date.now();
    
    while (this.currentBatch.size > 0 && (Date.now() - startTime) < timeout) {
      await this.sleep(100);
    }
    
    this.isProcessing = false;
    console.log('Embedding processor stopped');
  }

  /**
   * Process a single bullet for embedding
   */
  async processBullet(bulletId: string): Promise<boolean> {
    try {
      // Get bullet data
      const bullet = await getById<Bullet>('bullets', bulletId);
      if (!bullet) {
        console.error(`Bullet not found: ${bulletId}`);
        return false;
      }

      // Check if OpenAI service is available
      const openaiService = getOpenAIService();
      if (!openaiService.hasApiKey()) {
        console.error('OpenAI API key not configured');
        return false;
      }

      // Generate embedding
      console.log(`Generating embedding for bullet: ${bulletId}`);
      const embeddingVector = await openaiService.generateEmbedding(bullet.text);

      // Store embedding with proper ArrayBuffer handling
      const embedding: Embedding = {
        bulletId,
        vector: embeddingVector.buffer as ArrayBuffer, // Type assertion for compatibility
        vendor: 'openai',
        model: 'text-embedding-3-small',
        dims: embeddingVector.length,
        version: CURRENT_EMBEDDING_VERSION,
        createdAt: Date.now()
      };

      await create('embeddings', embedding);

      // Update bullet state to ready
      const stateMachine = getEmbeddingStateMachine();
      await stateMachine.transitionToReady(bulletId);

      // Update project centroid
      await this.updateProjectCentroid(bullet.projectId);

      console.log(`Successfully processed embedding for bullet: ${bulletId}`);
      this.processingStats.processed++;
      return true;

    } catch (error) {
      console.error(`Failed to process bullet ${bulletId}:`, error);
      
      // Mark as failed
      const stateMachine = getEmbeddingStateMachine();
      await stateMachine.transitionToFailed(bulletId);
      
      this.processingStats.failed++;
      return false;
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    isProcessing: boolean;
    processed: number;
    failed: number;
    queueSize: number;
    uptime: number;
  } {
    return {
      isProcessing: this.isProcessing,
      processed: this.processingStats.processed,
      failed: this.processingStats.failed,
      queueSize: this.currentBatch.size,
      uptime: Date.now() - this.processingStats.startTime
    };
  }

  /**
   * Process pending embeddings for all stale bullets
   */
  async processAllStale(): Promise<number> {
    const stateMachine = getEmbeddingStateMachine();
    return stateMachine.requeueStale();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Main processing loop
   */
  private async processingLoop(): Promise<void> {
    while (!this.shouldStop) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
      
      // Wait before next iteration
      await this.sleep(PROCESSOR_CONFIG.POLL_INTERVAL);
    }
  }

  /**
   * Process a batch of queue items
   */
  private async processBatch(): Promise<void> {
    const stateMachine = getEmbeddingStateMachine();
    
    // Get available slots
    const availableSlots = PROCESSOR_CONFIG.BATCH_SIZE - this.currentBatch.size;
    if (availableSlots <= 0) {
      return;
    }

    // Get queue items
    const queueItems = await stateMachine.getQueue(availableSlots);
    if (queueItems.length === 0) {
      return;
    }

    // Process items concurrently
    const promises = queueItems.map(item => this.processQueueItem(item));
    await Promise.allSettled(promises);
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: EmbedQueueItem): Promise<void> {
    const { id: queueItemId, bulletId } = queueItem;
    
    // Track in current batch
    this.currentBatch.add(bulletId);
    
    try {
      // Set processing timeout
      const timeoutPromise = this.sleep(PROCESSOR_CONFIG.MAX_PROCESSING_TIME).then(() => {
        throw new Error('Processing timeout');
      });

      // Process with timeout
      await Promise.race([
        this.processBullet(bulletId),
        timeoutPromise
      ]);

      // Remove from queue on success
      const stateMachine = getEmbeddingStateMachine();
      await stateMachine.dequeue(queueItemId);

    } catch (error) {
      console.error(`Failed to process queue item ${queueItemId}:`, error);
    } finally {
      // Remove from current batch
      this.currentBatch.delete(bulletId);
    }
  }

  /**
   * Update project centroid after embedding change
   */
  private async updateProjectCentroid(projectId: string): Promise<void> {
    try {
      const project = await getById<Project>('projects', projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        return;
      }

      // Get all embeddings for bullets in this project
      const embeddings = await this.getProjectEmbeddings(projectId);
      if (embeddings.length === 0) {
        console.warn(`No embeddings found for project: ${projectId}`);
        return;
      }

      // Calculate new centroid
      const vectors = embeddings.map(e => new Float32Array(e.vector));
      const centroid = calculateCentroid(vectors);

      if (!centroid) {
        console.warn(`Failed to calculate centroid for project: ${projectId}`);
        return;
      }

      // Update project with proper ArrayBuffer handling
      const updatedProject: Project = {
        ...project,
        centroidVector: centroid.buffer as ArrayBuffer, // Type assertion for compatibility
        vectorDimensions: centroid.length,
        bulletCount: embeddings.length,
        embeddingVersion: CURRENT_EMBEDDING_VERSION,
        updatedAt: Date.now()
      };

      await executeTransaction(['projects'], 'readwrite', async (_, stores) => {
        await new Promise<void>((resolve, reject) => {
          const request = stores.projects.put(updatedProject);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      console.log(`Updated centroid for project: ${projectId}`);

    } catch (error) {
      console.error(`Failed to update project centroid ${projectId}:`, error);
    }
  }

  /**
   * Get all embeddings for a project
   */
  private async getProjectEmbeddings(projectId: string): Promise<Embedding[]> {
    return executeTransaction(['bullets', 'embeddings'], 'readonly', async (_, stores) => {
      return new Promise<Embedding[]>((resolve, reject) => {
        const embeddings: Embedding[] = [];
        
        // Get bullets for this project
        const bulletIndex = stores.bullets.index('projectId');
        const bulletCursor = bulletIndex.openCursor(IDBKeyRange.only(projectId));
        
        bulletCursor.onsuccess = () => {
          const cursor = bulletCursor.result;
          if (cursor) {
            const bullet = cursor.value as Bullet;
            
            // Get embedding for this bullet
            const embeddingRequest = stores.embeddings.get(bullet.id);
            embeddingRequest.onsuccess = () => {
              if (embeddingRequest.result) {
                embeddings.push(embeddingRequest.result as Embedding);
              }
              cursor.continue();
            };
            embeddingRequest.onerror = () => reject(embeddingRequest.error);
            
          } else {
            resolve(embeddings);
          }
        };
        
        bulletCursor.onerror = () => reject(bulletCursor.error);
      });
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Global Processor Instance
// ============================================================================

let globalProcessor: EmbeddingProcessor | null = null;

/**
 * Get global embedding processor (singleton)
 */
export function getEmbeddingProcessor(): EmbeddingProcessor {
  if (!globalProcessor) {
    globalProcessor = new EmbeddingProcessor();
    
    // Auto-start if configured
    if (PROCESSOR_CONFIG.AUTO_START) {
      globalProcessor.start();
    }
  }
  return globalProcessor;
}

/**
 * Reset processor instance (for testing)
 */
export function resetEmbeddingProcessor(): void {
  if (globalProcessor) {
    globalProcessor.stop();
  }
  globalProcessor = null;
}