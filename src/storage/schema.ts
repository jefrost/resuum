/**
 * IndexedDB Schema Definition
 * Simplified for AI-powered analysis approach
 */

import type { DatabaseSchema } from '../types';

// ============================================================================
// Database Schema
// ============================================================================

export const DB_SCHEMA: DatabaseSchema = {
  name: 'ResuumDB',
  version: 2, // Incremented for schema changes
  stores: [
    {
      name: 'roles',
      keyPath: 'id',
      indexes: [
        { name: 'orderIndex', keyPath: 'orderIndex' },
        { name: 'company', keyPath: 'company' },
        { name: 'startDate', keyPath: 'startDate' },
        { name: 'endDate', keyPath: 'endDate' }
      ]
    },
    {
      name: 'projects',
      keyPath: 'id',
      indexes: [
        { name: 'roleId', keyPath: 'roleId' },
        { name: 'name', keyPath: 'name' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'role_created', keyPath: ['roleId', 'createdAt'] }
      ]
    },
    {
      name: 'bullets',
      keyPath: 'id',
      indexes: [
        { name: 'roleId', keyPath: 'roleId' },
        { name: 'projectId', keyPath: 'projectId' },
        { name: 'source', keyPath: 'source' },
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'role_project', keyPath: ['roleId', 'projectId'] }
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
// Schema Migration Utilities
// ============================================================================

/**
 * Handle database upgrades when schema version changes
 */
export function handleSchemaUpgrade(
  event: IDBVersionChangeEvent,
  db: IDBDatabase
): void {
  const oldVersion = event.oldVersion;
  
  console.log(`Upgrading database from version ${oldVersion} to ${DB_SCHEMA.version}`);
  
  // Handle upgrade from version 1 to 2 (remove embedding infrastructure)
  if (oldVersion === 1) {
    // Remove obsolete stores if they exist
    if (db.objectStoreNames.contains('embeddings')) {
      db.deleteObjectStore('embeddings');
    }
    if (db.objectStoreNames.contains('embedQueue')) {
      db.deleteObjectStore('embedQueue');
    }
    
    console.log('Removed obsolete embedding stores');
  }
}

/**
 * Simple hash function for any remaining fingerprinting needs
 */
export function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}