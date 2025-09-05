/**
 * UUID/ULID generation utilities with crypto fallback
 */

/**
 * Generate cryptographically secure UUID v4
 */
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      // Use crypto.getRandomValues for secure generation
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      
      // Ensure we have enough bytes
      if (bytes.length < 16) {
        throw new Error('Failed to generate sufficient random bytes');
      }
      
      // Set version (4) and variant bits with safe array access
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      
      const hex = Array.from(bytes)
        .map(b => (b ?? 0).toString(16).padStart(2, '0'))
        .join('');
      
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
      ].join('-');
    } else {
      // Fallback to Math.random (less secure, for testing)
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  }
  
  /**
   * Generate ULID-style ID with timestamp prefix for natural sorting
   */
  export function generateULID(): string {
    const timestamp = Date.now();
    const timestampPart = timestamp.toString(36).padStart(10, '0');
    const randomPart = generateRandomString(16);
    return `${timestampPart}_${randomPart}`;
  }
  
  /**
   * Generate random string for ULID random component
   */
  function generateRandomString(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      
      for (let i = 0; i < Math.min(bytes.length, length); i++) {
        const byteValue = bytes[i] ?? 0;
        result += chars[byteValue % chars.length] ?? '0';
      }
    } else {
      // Fallback for testing
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)] ?? '0';
      }
    }
    
    return result;
  }
  
  /**
   * Generate stable "No Project" entity ID for a role
   */
  export function generateNoProjectId(roleId: string): string {
    return `no_project_${roleId}`;
  }
  
  /**
   * Check if an ID is a "No Project" entity
   */
  export function isNoProjectId(projectId: string): boolean {
    return projectId.startsWith('no_project_');
  }
  
  /**
   * Extract role ID from "No Project" entity ID
   */
  export function extractRoleFromNoProjectId(noProjectId: string): string | null {
    if (!isNoProjectId(noProjectId)) {
      return null;
    }
    return noProjectId.replace('no_project_', '');
  }
  
  /**
   * Validate UUID format
   */
  export function isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
  
  /**
   * Validate ULID format
   */
  export function isValidULID(id: string): boolean {
    const ulidRegex = /^[0-9a-z]{10}_[0-9a-z]{16}$/i;
    return ulidRegex.test(id);
  }
  
  /**
   * Validate any supported ID format
   */
  export function isValidId(id: string): boolean {
    return isValidUUID(id) || isValidULID(id) || isNoProjectId(id);
  }
  
  /**
   * Generate deterministic ID for testing (seeded)
   */
  export function generateTestId(seed: string, type: 'uuid' | 'ulid' = 'uuid'): string {
    // Simple seeded random for deterministic test IDs
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use hash as seed for deterministic generation
    const seededRandom = () => {
      hash = (hash * 9301 + 49297) % 233280;
      return hash / 233280;
    };
    
    if (type === 'ulid') {
      const timestampPart = Date.now().toString(36).padStart(10, '0');
      let randomPart = '';
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      for (let i = 0; i < 16; i++) {
        const charIndex = Math.floor(seededRandom() * chars.length);
        randomPart += chars[charIndex] ?? '0';
      }
      return `${timestampPart}_${randomPart}`;
    } else {
      // Generate deterministic UUID
      const bytes = new Array(16);
      for (let i = 0; i < 16; i++) {
        bytes[i] = Math.floor(seededRandom() * 256);
      }
      
      // Ensure we have valid bytes and set version/variant bits
      if (bytes.length >= 16) {
        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      }
      
      const hex = bytes
        .map(b => (b ?? 0).toString(16).padStart(2, '0'))
        .join('');
      
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
      ].join('-');
    }
  }
  
  /**
   * ID generation strategy based on environment
   */
  export function createId(type: 'role' | 'project' | 'bullet' | 'embed_queue' = 'bullet'): string {
    // Use ULID for items that benefit from chronological sorting
    if (type === 'bullet' || type === 'embed_queue') {
      return generateULID();
    }
    
    // Use UUID for other entities
    return generateUUID();
  }