/**
 * Embedding state machine and queue management
 */

import { executeTransaction, getById, update, deleteById, getBulletsByState } from './transactions';
import { EMBEDDING_STATES, EMBEDDING_RETRY_LIMITS, QUEUE_PRIORITIES } from './schema';
import { createId } from '../utils/uuid';
import type { Bullet, EmbedQueueItem, EmbeddingState } from '../types';

// ============================================================================
// Embedding State Machine
// ============================================================================

export class EmbeddingStateMachine {
  /**
   * Transition bullet to pending state and add to queue
   */
  async transitionToPending(bulletId: string, priority: number = QUEUE_PRIORITIES.NORMAL): Promise<void> {
    await executeTransaction(['bullets', 'embedQueue'], 'readwrite', async (_, stores) => {
      // Get current bullet
      const bulletRequest = stores.bullets.get(bulletId);
      const bullet = await new Promise<Bullet>((resolve, reject) => {
        bulletRequest.onsuccess = () => {
          if (bulletRequest.result) {
            resolve(bulletRequest.result as Bullet);
          } else {
            reject(new Error(`Bullet not found: ${bulletId}`));
          }
        };
        bulletRequest.onerror = () => reject(bulletRequest.error);
      });

      // Update bullet state
      const updatedBullet: Bullet = {
        ...bullet,
        embeddingState: EMBEDDING_STATES.PENDING,
        lastModified: Date.now()
      };

      await new Promise<void>((resolve, reject) => {
        const updateRequest = stores.bullets.put(updatedBullet);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      });

      // Check if already in queue
      const queueIndex = stores.embedQueue.index('bulletId');
      const existingRequest = queueIndex.get(bulletId);
      
      await new Promise<void>((resolve, reject) => {
        existingRequest.onsuccess = () => {
          if (!existingRequest.result) {
            // Add to queue
            const queueItem: EmbedQueueItem = {
              id: createId('embed_queue'),
              bulletId,
              priority,
              createdAt: Date.now(),
              retryCount: 0
            };

            const addRequest = stores.embedQueue.add(queueItem);
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
          } else {
            resolve(); // Already in queue
          }
        };
        existingRequest.onerror = () => reject(existingRequest.error);
      });
    });
  }

  /**
   * Transition bullet to ready state and remove from queue
   */
  async transitionToReady(bulletId: string): Promise<void> {
    await executeTransaction(['bullets', 'embedQueue'], 'readwrite', async (_, stores) => {
      // Update bullet state
      const bulletRequest = stores.bullets.get(bulletId);
      const bullet = await new Promise<Bullet>((resolve, reject) => {
        bulletRequest.onsuccess = () => {
          if (bulletRequest.result) {
            resolve(bulletRequest.result as Bullet);
          } else {
            reject(new Error(`Bullet not found: ${bulletId}`));
          }
        };
        bulletRequest.onerror = () => reject(bulletRequest.error);
      });

      const updatedBullet: Bullet = {
        ...bullet,
        embeddingState: EMBEDDING_STATES.READY,
        lastEmbeddedAt: Date.now(),
        retryCount: 0,
        lastModified: Date.now()
      };

      await new Promise<void>((resolve, reject) => {
        const updateRequest = stores.bullets.put(updatedBullet);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      });

      // Remove from queue
      const queueIndex = stores.embedQueue.index('bulletId');
      const queueRequest = queueIndex.get(bulletId);
      
      await new Promise<void>((resolve, reject) => {
        queueRequest.onsuccess = () => {
          if (queueRequest.result) {
            const deleteRequest = stores.embedQueue.delete(queueRequest.result.id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          } else {
            resolve(); // Not in queue
          }
        };
        queueRequest.onerror = () => reject(queueRequest.error);
      });
    });
  }

  /**
   * Transition bullet to stale state (when text changes)
   */
  async transitionToStale(bulletId: string): Promise<void> {
    const bullet = await getById<Bullet>('bullets', bulletId);
    if (!bullet) {
      throw new Error(`Bullet not found: ${bulletId}`);
    }

    const updatedBullet: Bullet = {
      ...bullet,
      embeddingState: EMBEDDING_STATES.STALE,
      lastModified: Date.now()
    };

    await update('bullets', updatedBullet);
  }

  /**
   * Transition bullet to failed state with retry logic
   */
  async transitionToFailed(bulletId: string): Promise<void> {
    await executeTransaction(['bullets', 'embedQueue'], 'readwrite', async (_, stores) => {
      // Get current bullet
      const bulletRequest = stores.bullets.get(bulletId);
      const bullet = await new Promise<Bullet>((resolve, reject) => {
        bulletRequest.onsuccess = () => {
          if (bulletRequest.result) {
            resolve(bulletRequest.result as Bullet);
          } else {
            reject(new Error(`Bullet not found: ${bulletId}`));
          }
        };
        bulletRequest.onerror = () => reject(bulletRequest.error);
      });

      const retryCount = bullet.retryCount + 1;
      const shouldRetry = retryCount <= EMBEDDING_RETRY_LIMITS.MAX_RETRIES;

      if (shouldRetry) {
        // Schedule retry with exponential backoff
        const updatedBullet: Bullet = {
          ...bullet,
          embeddingState: EMBEDDING_STATES.PENDING,
          retryCount,
          lastModified: Date.now()
        };

        await new Promise<void>((resolve, reject) => {
          const updateRequest = stores.bullets.put(updatedBullet);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        });

        // Update queue item with delay
        const queueIndex = stores.embedQueue.index('bulletId');
        const queueRequest = queueIndex.get(bulletId);
        
        await new Promise<void>((resolve, reject) => {
          queueRequest.onsuccess = () => {
            if (queueRequest.result) {
              const delayMs = EMBEDDING_RETRY_LIMITS.BACKOFF_BASE * 
                Math.pow(EMBEDDING_RETRY_LIMITS.BACKOFF_MULTIPLIER, retryCount - 1);
              
              const updatedQueueItem: EmbedQueueItem = {
                ...queueRequest.result,
                retryCount,
                createdAt: Date.now() + delayMs // Delay retry
              };

              const updateRequest = stores.embedQueue.put(updatedQueueItem);
              updateRequest.onsuccess = () => resolve();
              updateRequest.onerror = () => reject(updateRequest.error);
            } else {
              resolve();
            }
          };
          queueRequest.onerror = () => reject(queueRequest.error);
        });
      } else {
        // Mark as permanently failed
        const updatedBullet: Bullet = {
          ...bullet,
          embeddingState: EMBEDDING_STATES.FAILED,
          retryCount,
          lastModified: Date.now()
        };

        await new Promise<void>((resolve, reject) => {
          const updateRequest = stores.bullets.put(updatedBullet);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        });

        // Remove from queue
        const queueIndex = stores.embedQueue.index('bulletId');
        const queueRequest = queueIndex.get(bulletId);
        
        await new Promise<void>((resolve, reject) => {
          queueRequest.onsuccess = () => {
            if (queueRequest.result) {
              const deleteRequest = stores.embedQueue.delete(queueRequest.result.id);
              deleteRequest.onsuccess = () => resolve();
              deleteRequest.onerror = () => reject(deleteRequest.error);
            } else {
              resolve();
            }
          };
          queueRequest.onerror = () => reject(queueRequest.error);
        });
      }
    });
  }

  /**
   * Get bullets by state with pagination
   */
  async getBulletsByState(
    state: EmbeddingState, 
    limit?: number, 
    offset?: number
  ): Promise<Bullet[]> {
    const bullets = await getBulletsByState(state);
    
    if (limit !== undefined) {
      const start = offset || 0;
      return bullets.slice(start, start + limit);
    }
    
    return bullets;
  }

  /**
   * Get embedding queue with priority ordering
   */
  async getQueue(limit?: number): Promise<EmbedQueueItem[]> {
    return executeTransaction(['embedQueue'], 'readonly', async (_, stores) => {
      return new Promise<EmbedQueueItem[]>((resolve, reject) => {
        const index = stores.embedQueue.index('priority_created');
        const request = limit ? index.getAll(null, limit) : index.getAll();
        
        request.onsuccess = () => {
          const items = (request.result || []) as EmbedQueueItem[];
          
          // Filter out items that aren't ready yet (retry delay)
          const now = Date.now();
          const readyItems = items.filter(item => item.createdAt <= now);
          
          // Sort by priority, then by creation time
          readyItems.sort((a, b) => {
            if (a.priority !== b.priority) {
              return a.priority - b.priority; // Lower number = higher priority
            }
            return a.createdAt - b.createdAt; // Older first
          });
          
          resolve(limit ? readyItems.slice(0, limit) : readyItems);
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to get queue: ${request.error?.message}`));
        };
      });
    });
  }

  /**
   * Peek at next queue item without removing it
   */
  async peekQueue(): Promise<EmbedQueueItem | null> {
    const items = await this.getQueue(1);
    return items.length > 0 ? (items[0] || null) : null;
  }

  /**
   * Remove item from queue (for processing)
   */
  async dequeue(queueItemId: string): Promise<void> {
    await deleteById('embedQueue', queueItemId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    byPriority: Record<number, number>;
    oldestItem: number | undefined;
    avgRetryCount: number;
  }> {
    const items = await this.getQueue();
    
    const oldestItem = items.length > 0 ? Math.min(...items.map(i => i.createdAt)) : undefined;
    
    const stats = {
      total: items.length,
      byPriority: {} as Record<number, number>,
      oldestItem,
      avgRetryCount: items.length > 0 ? items.reduce((sum, i) => sum + i.retryCount, 0) / items.length : 0
    };
    
    // Count by priority
    for (const item of items) {
      stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Clear failed items from queue (cleanup)
   */
  async clearFailedQueue(): Promise<number> {
    return executeTransaction(['embedQueue', 'bullets'], 'readwrite', async (_, stores) => {
      let clearedCount = 0;
      
      // Get all queue items
      const queueRequest = stores.embedQueue.getAll();
      const queueItems = await new Promise<EmbedQueueItem[]>((resolve, reject) => {
        queueRequest.onsuccess = () => resolve(queueRequest.result || []);
        queueRequest.onerror = () => reject(queueRequest.error);
      });
      
      // Check each item's bullet state
      for (const queueItem of queueItems) {
        const bulletRequest = stores.bullets.get(queueItem.bulletId);
        const bullet = await new Promise<Bullet | null>((resolve, reject) => {
          bulletRequest.onsuccess = () => resolve(bulletRequest.result || null);
          bulletRequest.onerror = () => reject(bulletRequest.error);
        });
        
        // Remove queue items for failed or missing bullets
        if (!bullet || bullet.embeddingState === EMBEDDING_STATES.FAILED) {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = stores.embedQueue.delete(queueItem.id);
            deleteRequest.onsuccess = () => {
              clearedCount++;
              resolve();
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      }
      
      return clearedCount;
    });
  }

  /**
   * Reset all stale bullets to pending (for reprocessing)
   */
  async requeueStale(priority: number = QUEUE_PRIORITIES.LOW): Promise<number> {
    const staleBullets = await this.getBulletsByState(EMBEDDING_STATES.STALE);
    
    for (const bullet of staleBullets) {
      await this.transitionToPending(bullet.id, priority);
    }
    
    return staleBullets.length;
  }

  /**
   * Coalesce duplicate queue entries (cleanup)
   */
  async coalesceQueue(): Promise<number> {
    return executeTransaction(['embedQueue'], 'readwrite', async (_, stores) => {
      const seenBullets = new Set<string>();
      let removedCount = 0;
      
      // Get all queue items ordered by priority
      const index = stores.embedQueue.index('priority_created');
      const cursor = index.openCursor();
      
      await new Promise<void>((resolve, reject) => {
        cursor.onsuccess = () => {
          const cursorResult = cursor.result;
          if (cursorResult) {
            const queueItem = cursorResult.value as EmbedQueueItem;
            
            if (seenBullets.has(queueItem.bulletId)) {
              // Duplicate - remove this one
              cursorResult.delete();
              removedCount++;
            } else {
              seenBullets.add(queueItem.bulletId);
            }
            
            cursorResult.continue();
          } else {
            resolve();
          }
        };
        
        cursor.onerror = () => reject(cursor.error);
      });
      
      return removedCount;
    });
  }
}

// ============================================================================
// Global State Machine Instance
// ============================================================================

let globalStateMachine: EmbeddingStateMachine | null = null;

/**
 * Get global embedding state machine (singleton)
 */
export function getEmbeddingStateMachine(): EmbeddingStateMachine {
  if (!globalStateMachine) {
    globalStateMachine = new EmbeddingStateMachine();
  }
  return globalStateMachine;
}

/**
 * Reset state machine (for testing)
 */
export function resetEmbeddingStateMachine(): void {
  globalStateMachine = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Mark bullet text as changed (transition to stale)
 */
export async function markBulletChanged(bulletId: string): Promise<void> {
  const stateMachine = getEmbeddingStateMachine();
  await stateMachine.transitionToStale(bulletId);
}

/**
 * Queue bullet for embedding with high priority
 */
export async function queueBulletForEmbedding(bulletId: string): Promise<void> {
  const stateMachine = getEmbeddingStateMachine();
  await stateMachine.transitionToPending(bulletId, QUEUE_PRIORITIES.HIGH);
}

/**
 * Mark embedding as completed successfully
 */
export async function markEmbeddingComplete(bulletId: string): Promise<void> {
  const stateMachine = getEmbeddingStateMachine();
  await stateMachine.transitionToReady(bulletId);
}

/**
 * Mark embedding as failed
 */
export async function markEmbeddingFailed(bulletId: string): Promise<void> {
  const stateMachine = getEmbeddingStateMachine();
  await stateMachine.transitionToFailed(bulletId);
}

/**
 * Get next item to process from queue
 */
export async function getNextQueueItem(): Promise<EmbedQueueItem | null> {
  const stateMachine = getEmbeddingStateMachine();
  return stateMachine.peekQueue();
}

/**
 * Complete processing of queue item
 */
export async function completeQueueItem(queueItemId: string): Promise<void> {
  const stateMachine = getEmbeddingStateMachine();
  await stateMachine.dequeue(queueItemId);
}