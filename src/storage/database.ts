/**
 * Database initialization and management
 * Simplified for AI-analysis approach
 */

import { DB_SCHEMA, handleSchemaUpgrade } from './schema';

// ============================================================================
// Database Management
// ============================================================================

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_SCHEMA.name, DB_SCHEMA.version);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log(`Database ${DB_SCHEMA.name} opened successfully`);
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      console.log(`Upgrading database from version ${event.oldVersion} to ${DB_SCHEMA.version}`);
      
      // Handle schema upgrades
      handleSchemaUpgrade(event, db);
      
      // Create new stores
      DB_SCHEMA.stores.forEach(storeConfig => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath
          });
          
          // Create indexes
          storeConfig.indexes?.forEach(indexConfig => {
            store.createIndex(
              indexConfig.name,
              indexConfig.keyPath,
              indexConfig.options
            );
          });
          
          console.log(`Created store: ${storeConfig.name}`);
        }
      });
    };
  });
}

/**
 * Get database instance
 */
export async function getDatabase(): Promise<IDBDatabase> {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('Database connection closed');
  }
}

/**
 * Clear all data from database
 */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(db.objectStoreNames, 'readwrite');
  
  const promises: Promise<void>[] = [];
  
  for (const storeName of db.objectStoreNames) {
    const store = transaction.objectStore(storeName);
    promises.push(new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  }
  
  await Promise.all(promises);
  console.log('Database cleared successfully');
}

/**
 * Get database storage usage info
 */
export async function getDatabaseInfo(): Promise<{
  stores: Array<{ name: string; count: number }>;
  totalSize: number;
}> {
  const db = await getDatabase();
  const stores: Array<{ name: string; count: number }> = [];
  
  for (const storeName of db.objectStoreNames) {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    const count = await new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    stores.push({ name: storeName, count });
  }
  
  return {
    stores,
    totalSize: 0 // Browser doesn't provide easy access to storage size
  };
}