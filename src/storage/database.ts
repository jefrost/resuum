/**
 * IndexedDB connection management and initialization
 */

import { detectBrowserCapabilities } from '../utils/feature-detection';
import { DATABASE_SCHEMA, DB_NAME, DB_VERSION, validateStoreConfig } from './schema';
import { generateNoProjectId } from '../utils/uuid';
import type { Role, Project } from '../types';

// ============================================================================
// Database Connection Management
// ============================================================================

export class DatabaseConnection {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    // Check browser capabilities on initialization
    const capabilities = detectBrowserCapabilities();
    if (!capabilities.indexedDB) {
      throw new Error('IndexedDB is not supported in this browser. Please use Chrome 91+, Firefox 90+, Safari 14+, or Edge 91+.');
    }
  }

  /**
   * Open database connection with schema migration
   */
  async open(): Promise<IDBDatabase> {
    if (this.db && !this.db.version) {
      // Database was closed, reset
      this.db = null;
      this.openPromise = null;
    }

    if (this.db) {
      return this.db;
    }

    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = this.performOpen();
    return this.openPromise;
  }

  private async performOpen(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = request.error;
        console.error('Failed to open database:', error);
        reject(new Error(`Database connection failed: ${error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Handle unexpected close
        this.db.onclose = () => {
          console.warn('Database connection closed unexpectedly');
          this.db = null;
          this.openPromise = null;
        };

        // Handle version change from another tab
        this.db.onversionchange = () => {
          console.warn('Database version changed by another tab');
          this.db?.close();
          this.db = null;
          this.openPromise = null;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const transaction = request.transaction;

        if (!transaction) {
          reject(new Error('No transaction available during upgrade'));
          return;
        }

        try {
          this.performMigration(db, event.oldVersion, event.newVersion || DB_VERSION);
        } catch (error) {
          console.error('Migration failed:', error);
          reject(error);
        }
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked by another tab');
        reject(new Error('Database upgrade blocked. Please close other tabs and try again.'));
      };
    });
  }

  /**
   * Perform database schema migration
   */
  private performMigration(db: IDBDatabase, oldVersion: number, newVersion: number): void {
    console.log(`Migrating database from version ${oldVersion} to ${newVersion}`);

    // For version 1 (initial schema), create all stores
    if (oldVersion < 1) {
      this.createInitialSchema(db);
    }

    // Future migrations would go here
    // if (oldVersion < 2) { ... }
  }

  /**
   * Create initial database schema
   */
  private createInitialSchema(db: IDBDatabase): void {
    for (const storeConfig of DATABASE_SCHEMA.stores) {
      if (!validateStoreConfig(storeConfig)) {
        throw new Error(`Invalid store configuration: ${storeConfig.name}`);
      }

      // Create object store
      const store = db.createObjectStore(storeConfig.name, {
        keyPath: storeConfig.keyPath
      });

      // Create indexes
      if (storeConfig.indexes) {
        for (const indexConfig of storeConfig.indexes) {
          store.createIndex(
            indexConfig.name,
            indexConfig.keyPath,
            indexConfig.options || {}
          );
        }
      }
    }

    console.log('Initial database schema created successfully');
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.openPromise = null;
    }
  }

  /**
   * Get current database instance
   */
  getDatabase(): IDBDatabase | null {
    return this.db;
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.db !== null;
  }
}

// ============================================================================
// Global Database Instance
// ============================================================================

let globalConnection: DatabaseConnection | null = null;

/**
 * Get global database connection (singleton)
 */
export async function getDatabase(): Promise<IDBDatabase> {
  if (!globalConnection) {
    globalConnection = new DatabaseConnection();
  }
  return globalConnection.open();
}

/**
 * Close global database connection
 */
export function closeDatabase(): void {
  if (globalConnection) {
    globalConnection.close();
    globalConnection = null;
  }
}

/**
 * Reset database connection (for testing)
 */
export function resetDatabaseConnection(): void {
  closeDatabase();
}

// ============================================================================
// Automatic "No Project" Entity Management
// ============================================================================

/**
 * Ensure "No Project" entity exists for a role
 */
export async function ensureNoProjectEntity(role: Role): Promise<Project> {
  const db = await getDatabase();
  const transaction = db.transaction(['projects'], 'readwrite');
  const store = transaction.objectStore('projects');
  
  const noProjectId = generateNoProjectId(role.id);
  
  return new Promise((resolve, reject) => {
    const getRequest = store.get(noProjectId);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        // "No Project" entity already exists
        resolve(getRequest.result as Project);
      } else {
        // Create new "No Project" entity
        const noProject: Project = {
          id: noProjectId,
          roleId: role.id,
          name: 'No Project',
          description: 'Bullets not assigned to a specific project',
          centroidVector: new ArrayBuffer(0),
          vectorDimensions: 0,
          bulletCount: 0,
          embeddingVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const addRequest = store.add(noProject);
        
        addRequest.onsuccess = () => {
          resolve(noProject);
        };
        
        addRequest.onerror = () => {
          reject(new Error(`Failed to create "No Project" entity: ${addRequest.error?.message}`));
        };
      }
    };
    
    getRequest.onerror = () => {
      reject(new Error(`Failed to check for "No Project" entity: ${getRequest.error?.message}`));
    };
  });
}

/**
 * Database health check
 */
export async function performHealthCheck(): Promise<{
  isHealthy: boolean;
  version: number;
  stores: string[];
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    const db = await getDatabase();
    const stores = Array.from(db.objectStoreNames);
    
    // Check if all expected stores exist
    for (const expectedStore of DATABASE_SCHEMA.stores) {
      if (!stores.includes(expectedStore.name)) {
        issues.push(`Missing object store: ${expectedStore.name}`);
      }
    }
    
    return {
      isHealthy: issues.length === 0,
      version: db.version,
      stores,
      issues
    };
  } catch (error) {
    issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      isHealthy: false,
      version: 0,
      stores: [],
      issues
    };
  }
}