/**
 * IndexedDB schema definition and Unicode-safe fingerprinting
 */

import type { DatabaseSchema, IndexedDBStore } from '../types';

// ============================================================================
// Database Schema Configuration
// ============================================================================

export const DB_NAME = 'ResuumDB';
export const DB_VERSION = 1;
export const CURRENT_EMBEDDING_VERSION = 1;

export const DATABASE_SCHEMA: DatabaseSchema = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: [
    {
      name: 'roles',
      keyPath: 'id',
      indexes: [
        { name: 'orderIndex', keyPath: 'orderIndex' },
        { name: 'company', keyPath: 'company' }
      ]
    },
    {
      name: 'projects',
      keyPath: 'id',
      indexes: [
        { name: 'roleId', keyPath: 'roleId' },
        { name: 'name', keyPath: 'name' },
        { name: 'bulletCount', keyPath: 'bulletCount' },
        { name: 'embeddingVersion', keyPath: 'embeddingVersion' },
        { name: 'role_bulletCount', keyPath: ['roleId', 'bulletCount'] }
      ]
    },
    {
      name: 'bullets',
      keyPath: 'id',
      indexes: [
        { name: 'roleId', keyPath: 'roleId' },
        { name: 'projectId', keyPath: 'projectId' },
        { name: 'normalizedFingerprint', keyPath: 'normalizedFingerprint' },
        { name: 'embeddingState', keyPath: 'embeddingState' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'lastModified', keyPath: 'lastModified' },
        { name: 'role_project', keyPath: ['roleId', 'projectId'] },
        { name: 'role_state', keyPath: ['roleId', 'embeddingState'] },
        { name: 'project_state', keyPath: ['projectId', 'embeddingState'] },
        { name: 'fingerprint_role', keyPath: ['normalizedFingerprint', 'roleId'] }
      ]
    },
    {
      name: 'embeddings',
      keyPath: 'bulletId',
      indexes: [
        { name: 'vendor', keyPath: 'vendor' },
        { name: 'model', keyPath: 'model' },
        { name: 'version', keyPath: 'version' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'vendor_model_version', keyPath: ['vendor', 'model', 'version'] }
      ]
    },
    {
      name: 'embedQueue',
      keyPath: 'id',
      indexes: [
        { name: 'bulletId', keyPath: 'bulletId', options: { unique: true } },
        { name: 'priority', keyPath: 'priority' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'retryCount', keyPath: 'retryCount' },
        { name: 'priority_created', keyPath: ['priority', 'createdAt'] }
      ]
    },
    {
      name: 'settings',
      keyPath: 'key',
      indexes: []
    }
  ]
};

// ============================================================================
// Unicode-Aware Fingerprinting
// ============================================================================

/**
 * Normalize text for Unicode-aware fingerprinting
 * Uses NFKC normalization and diacritics stripping as specified
 */
export function normalizeForFingerprint(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  try {
    // Step 1: NFKC normalization (compatibility decomposition + canonical composition)
    let normalized = text.normalize('NFKC');
    
    // Step 2: Strip diacritics (accent marks)
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Step 3: Convert to lowercase
    normalized = normalized.toLowerCase();
    
    // Step 4: Remove punctuation and special characters
    normalized = normalized.replace(/[^\w\s]/g, '');
    
    // Step 5: Mask numbers with placeholder
    normalized = normalized.replace(/\d+/g, '<NUM>');
    
    // Step 6: Collapse whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Step 7: Trim
    normalized = normalized.trim();
    
    // Step 8: Hash if too long (optional, for storage efficiency)
    if (normalized.length > 200) {
      return hashString(normalized);
    }
    
    return normalized;
  } catch (error) {
    console.warn('Error normalizing text for fingerprint:', error);
    // Fallback to simple normalization
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\d+/g, '<NUM>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Simple string hash for long fingerprints
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Detect potential duplicate bullets based on fingerprint similarity
 */
export function detectDuplicateFingerprints(fingerprints: string[]): string[][] {
  const groups: string[][] = [];
  const processed = new Set<string>();
  
  for (const fingerprint of fingerprints) {
    if (processed.has(fingerprint)) {
      continue;
    }
    
    const group = [fingerprint];
    processed.add(fingerprint);
    
    // Find similar fingerprints (simple Levenshtein distance)
    for (const other of fingerprints) {
      if (other !== fingerprint && !processed.has(other)) {
        if (isSimilarFingerprint(fingerprint, other)) {
          group.push(other);
          processed.add(other);
        }
      }
    }
    
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Check if two fingerprints are similar (simple heuristic)
 */
function isSimilarFingerprint(a: string, b: string): boolean {
  if (a === b) return true;
  
  // Skip comparison if lengths are very different
  const lengthDiff = Math.abs(a.length - b.length);
  if (lengthDiff > Math.max(a.length, b.length) * 0.3) {
    return false;
  }
  
  // Simple word overlap check using Array.from() instead of spread
  const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
  
  const intersection = new Set(Array.from(wordsA).filter(w => wordsB.has(w)));
  const union = new Set([...Array.from(wordsA), ...Array.from(wordsB)]);
  
  const similarity = intersection.size / union.size;
  return similarity > 0.8; // 80% word overlap threshold
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate store configuration
 */
export function validateStoreConfig(store: IndexedDBStore): boolean {
  if (!store.name || !store.keyPath) {
    return false;
  }
  
  // Validate indexes
  if (store.indexes) {
    for (const index of store.indexes) {
      if (!index.name || !index.keyPath) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get store names from schema
 */
export function getStoreNames(): string[] {
  return DATABASE_SCHEMA.stores.map(store => store.name);
}

/**
 * Get indexes for a specific store
 */
export function getStoreIndexes(storeName: string): IndexedDBStore['indexes'] {
  const store = DATABASE_SCHEMA.stores.find(s => s.name === storeName);
  return store?.indexes || [];
}

/**
 * Check if schema needs migration
 */
export function needsMigration(currentVersion: number): boolean {
  return currentVersion < DB_VERSION;
}

// ============================================================================
// Constants for Embedding Management
// ============================================================================

export const EMBEDDING_STATES = {
  READY: 'ready' as const,
  PENDING: 'pending' as const,
  STALE: 'stale' as const,
  FAILED: 'failed' as const
};

export const EMBEDDING_RETRY_LIMITS = {
  MAX_RETRIES: 3,
  BACKOFF_BASE: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2
};

export const QUEUE_PRIORITIES = {
  HIGH: 1,    // New bullets, user-initiated
  NORMAL: 5,  // Batch operations
  LOW: 10     // Background processing
};