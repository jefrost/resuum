/**
 * Atomic transaction operations for IndexedDB
 */

import { getDatabase } from './database';
import type { Project, Bullet, Settings } from '../types';

// ============================================================================
// Transaction Management
// ============================================================================

export type TransactionMode = 'readonly' | 'readwrite';
export type StoreName = 'roles' | 'projects' | 'bullets' | 'embeddings' | 'embedQueue' | 'settings';

/**
 * Execute transaction with proper error handling and timeout
 */
export async function executeTransaction<T>(
  storeNames: StoreName[],
  mode: TransactionMode,
  operation: (transaction: IDBTransaction, stores: Record<StoreName, IDBObjectStore>) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  const transaction = db.transaction(storeNames, mode);
  
  // Create store map for easy access
  const stores = {} as Record<StoreName, IDBObjectStore>;
  for (const storeName of storeNames) {
    stores[storeName] = transaction.objectStore(storeName);
  }
  
  // Set up transaction timeout (30 seconds)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Transaction timeout after 30 seconds'));
    }, 30000);
  });
  
  // Execute operation with timeout
  const operationPromise = operation(transaction, stores);
  
  const completionPromise = new Promise<T>((resolve, reject) => {
    transaction.oncomplete = () => {
      operationPromise.then(resolve).catch(reject);
    };
    
    transaction.onerror = () => {
      reject(new Error(`Transaction failed: ${transaction.error?.message || 'Unknown error'}`));
    };
    
    transaction.onabort = () => {
      reject(new Error('Transaction was aborted'));
    };
  });
  
  return Promise.race([completionPromise, timeoutPromise]);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Generic get operation
 */
export async function getById<T>(storeName: StoreName, id: string): Promise<T | null> {
  return executeTransaction([storeName], 'readonly', async (_, stores) => {
    return new Promise<T | null>((resolve, reject) => {
      const request = stores[storeName].get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get ${storeName} by ID: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Generic get all operation
 */
export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  return executeTransaction([storeName], 'readonly', async (_, stores) => {
    return new Promise<T[]>((resolve, reject) => {
      const request = stores[storeName].getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get all ${storeName}: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Generic create operation
 */
export async function create<T>(storeName: StoreName, data: T): Promise<T> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    return new Promise<T>((resolve, reject) => {
      const request = stores[storeName].add(data);
      
      request.onsuccess = () => {
        resolve(data);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to create ${storeName}: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Generic update operation
 */
export async function update<T>(storeName: StoreName, data: T): Promise<T> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    return new Promise<T>((resolve, reject) => {
      const request = stores[storeName].put(data);
      
      request.onsuccess = () => {
        resolve(data);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to update ${storeName}: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Generic delete operation
 */
export async function deleteById(storeName: StoreName, id: string): Promise<void> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    return new Promise<void>((resolve, reject) => {
      const request = stores[storeName].delete(id as IDBValidKey);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to delete ${storeName}: ${request.error?.message}`));
      };
    });
  });
}

// ============================================================================
// Specialized Query Operations
// ============================================================================

/**
 * Get bullets by role ID
 */
export async function getBulletsByRole(roleId: string): Promise<Bullet[]> {
  return executeTransaction(['bullets'], 'readonly', async (_, stores) => {
    return new Promise<Bullet[]>((resolve, reject) => {
      const index = stores.bullets.index('roleId');
      const request = index.getAll(roleId);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get bullets by role: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Get bullets by project ID
 */
export async function getBulletsByProject(projectId: string): Promise<Bullet[]> {
  return executeTransaction(['bullets'], 'readonly', async (_, stores) => {
    return new Promise<Bullet[]>((resolve, reject) => {
      const index = stores.bullets.index('projectId');
      const request = index.getAll(projectId);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get bullets by project: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Get projects by role ID
 */
export async function getProjectsByRole(roleId: string): Promise<Project[]> {
  return executeTransaction(['projects'], 'readonly', async (_, stores) => {
    return new Promise<Project[]>((resolve, reject) => {
      const index = stores.projects.index('roleId');
      const request = index.getAll(roleId);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get projects by role: ${request.error?.message}`));
      };
    });
  });
}

/**
 * Get bullets by embedding state
 */
export async function getBulletsByState(state: string): Promise<Bullet[]> {
  return executeTransaction(['bullets'], 'readonly', async (_, stores) => {
    return new Promise<Bullet[]>((resolve, reject) => {
      const index = stores.bullets.index('embeddingState');
      const request = index.getAll(state);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get bullets by state: ${request.error?.message}`));
      };
    });
  });
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch create operation with progress tracking
 */
export async function batchCreate<T>(
  storeName: StoreName,
  items: T[],
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    const results: T[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue; // Skip undefined items
      
      await new Promise<void>((resolve, reject) => {
        const request = stores[storeName].add(item);
        
        request.onsuccess = () => {
          results.push(item);
          onProgress?.(i + 1, items.length);
          resolve();
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to create batch item ${i}: ${request.error?.message}`));
        };
      });
    }
    
    return results;
  });
}

/**
 * Batch update operation
 */
export async function batchUpdate<T>(
  storeName: StoreName,
  items: T[],
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    const results: T[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue; // Skip undefined items
      
      await new Promise<void>((resolve, reject) => {
        const request = stores[storeName].put(item);
        
        request.onsuccess = () => {
          results.push(item);
          onProgress?.(i + 1, items.length);
          resolve();
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to update batch item ${i}: ${request.error?.message}`));
        };
      });
    }
    
    return results;
  });
}

/**
 * Batch delete operation
 */
export async function batchDelete(
  storeName: StoreName,
  ids: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  return executeTransaction([storeName], 'readwrite', async (_, stores) => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!id) continue; // Skip undefined IDs
      
      await new Promise<void>((resolve, reject) => {
        const request = stores[storeName].delete(id as IDBValidKey);
        
        request.onsuccess = () => {
          onProgress?.(i + 1, ids.length);
          resolve();
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to delete batch item ${i}: ${request.error?.message}`));
        };
      });
    }
  });
}

// ============================================================================
// Settings Operations
// ============================================================================

/**
 * Get setting value
 */
export async function getSetting(key: string): Promise<string | number | boolean | null> {
  const setting = await getById<Settings>('settings', key);
  return setting?.value || null;
}

/**
 * Set setting value
 */
export async function setSetting(key: string, value: string | number | boolean): Promise<void> {
  const setting: Settings = { key, value };
  await update('settings', setting);
}

/**
 * Remove setting
 */
export async function removeSetting(key: string): Promise<void> {
  await deleteById('settings', key);
}