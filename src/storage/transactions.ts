/**
 * Storage transactions and database operations
 * Enhanced with role/project creation helpers
 */

import { getDatabase } from './database';
import { createId } from '../utils/uuid';
import type { Role, Project } from '../types';

// ============================================================================
// Basic CRUD Operations
// ============================================================================

/**
 * Get all records from a store
 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single record by ID
 */
export async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Create a new record
 */
export async function create<T>(storeName: string, record: T): Promise<T> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update an existing record
 */
export async function update<T>(storeName: string, record: T): Promise<T> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a record by ID
 */
export async function deleteById(storeName: string, id: string): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Settings Operations
// ============================================================================

/**
 * Get a setting value
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const transaction = db.transaction(['settings'], 'readonly');
  const store = transaction.objectStore('settings');
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Set a setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  
  return new Promise((resolve, reject) => {
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Role Creation Helpers
// ============================================================================

/**
 * Create a new role with proper defaults and "No Project" entity
 */
export async function createRoleWithDefaults(roleData: {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string | null;
  bulletsLimit?: number;
}): Promise<Role> {
  const db = await getDatabase();
  const transaction = db.transaction(['roles', 'projects'], 'readwrite');
  
  try {
    // Get current roles to determine order index
    const rolesStore = transaction.objectStore('roles');
    const existingRoles = await new Promise<Role[]>((resolve, reject) => {
      const request = rolesStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    // Create new role
    const newRole: Role = {
      id: createId('role'),
      title: roleData.title,
      company: roleData.company,
      orderIndex: existingRoles.length,
      bulletsLimit: roleData.bulletsLimit || 10,
      startDate: roleData.startDate || new Date().toISOString().slice(0, 7),
      endDate: roleData.endDate || null
    };
    
    // Save role
    await new Promise<void>((resolve, reject) => {
      const request = rolesStore.add(newRole);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Create "No Project" entity for this role
    const noProject: Project = {
      id: `no_project_${newRole.id}`,
      roleId: newRole.id,
      name: 'No Project',
      description: 'Default project for unassigned bullet points',
      bulletCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const projectsStore = transaction.objectStore('projects');
    await new Promise<void>((resolve, reject) => {
      const request = projectsStore.add(noProject);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return newRole;
    
  } catch (error) {
    transaction.abort();
    throw error;
  }
}

/**
 * Create a project with proper defaults
 */
export async function createProjectWithDefaults(projectData: {
  roleId: string;
  name: string;
  description?: string;
}): Promise<Project> {
  const newProject: Project = {
    id: createId('project'),
    roleId: projectData.roleId,
    name: projectData.name,
    description: projectData.description || '',
    bulletCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  return await create('projects', newProject);
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Get records with filtering
 */
export async function getFiltered<T>(
  storeName: string, 
  filterFn: (record: T) => boolean
): Promise<T[]> {
  const allRecords = await getAll<T>(storeName);
  return allRecords.filter(filterFn);
}

/**
 * Count records in a store
 */
export async function count(storeName: string): Promise<number> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records from a store
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * Execute multiple operations in a single transaction
 */
export async function executeTransaction(
  storeNames: string[],
  operations: (stores: { [key: string]: IDBObjectStore }) => Promise<void>
): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(storeNames, 'readwrite');
  
  const stores: { [key: string]: IDBObjectStore } = {};
  storeNames.forEach(name => {
    stores[name] = transaction.objectStore(name);
  });
  
  try {
    await operations(stores);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  } catch (error) {
    transaction.abort();
    throw error;
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Wrap database operations with error handling
 */
export async function safeOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Database operation failed'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}