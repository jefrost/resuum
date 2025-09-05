/**
 * Vector Mathematics for Recommendation Engine
 * Handles all vector operations with performance monitoring and error handling
 */

// ============================================================================
// Constants and Configuration
// ============================================================================

const BATCH_SIZE = 50; // Process vectors in batches to avoid blocking
const SIMILARITY_THRESHOLD = 0.85; // Redundancy threshold for MMR
const DEFAULT_TIMEOUT = 5000; // Default timeout in milliseconds

// ============================================================================
// Core Vector Operations
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length !== b.length) {
    throw new Error('Vector dimensions must match and vectors must be defined');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const valueA = a[i];
    const valueB = b[i];
    
    // Handle undefined values (shouldn't happen with Float32Array but being safe)
    if (valueA !== undefined && valueB !== undefined && !isNaN(valueA) && !isNaN(valueB)) {
      dotProduct += valueA * valueB;
      normA += valueA * valueA;
      normB += valueB * valueB;
    }
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

/**
 * Calculate multiple cosine similarities in batches
 * FIXED: Added default parameter for timeoutMs
 */
export function batchCosineSimilarity(
  baseVector: Float32Array,
  vectors: Float32Array[],
  startTime: number,
  timeoutMs: number = DEFAULT_TIMEOUT  // ← FIXED: Added default parameter
): number[] {
  const similarities: number[] = [];
  
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Operation timeout after ${timeoutMs}ms`);
    }
    
    const batch = vectors.slice(i, i + BATCH_SIZE);
    
    for (const vector of batch) {
      if (!vector) {
        similarities.push(0);
        continue;
      }
      
      try {
        similarities.push(cosineSimilarity(baseVector, vector));
      } catch (error) {
        console.warn('Similarity calculation failed for vector:', error);
        similarities.push(0);
      }
    }
  }
  
  return similarities;
}

/**
 * Calculate redundancy scores using Maximum Marginal Relevance (MMR)
 * FIXED: Added default parameter for timeoutMs
 */
export function calculateRedundancyScores(
  candidateVectors: Float32Array[],
  selectedVectors: Float32Array[],
  startTime: number,
  timeoutMs: number = DEFAULT_TIMEOUT  // ← FIXED: Added default parameter
): number[] {
  if (!selectedVectors || selectedVectors.length === 0) {
    return new Array(candidateVectors.length).fill(0);
  }
  
  const redundancyScores: number[] = [];
  
  for (let i = 0; i < candidateVectors.length; i++) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Redundancy calculation timeout after ${timeoutMs}ms`);
    }
    
    const candidate = candidateVectors[i];
    if (!candidate) {
      redundancyScores.push(0);
      continue;
    }
    
    let maxSimilarity = 0;
    
    // Find maximum similarity to any selected vector
    for (const selected of selectedVectors) {
      if (!selected) {
        continue;
      }
      
      try {
        const similarity = cosineSimilarity(candidate, selected);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      } catch (error) {
        console.warn('Redundancy calculation failed for vector pair:', error);
      }
    }
    
    redundancyScores.push(maxSimilarity);
  }
  
  return redundancyScores;
}

/**
 * Check if a vector is redundant compared to selected vectors
 */
export function isRedundant(
  candidateVector: Float32Array,
  selectedVectors: Float32Array[],
  threshold: number = SIMILARITY_THRESHOLD
): boolean {
  if (!selectedVectors || selectedVectors.length === 0) {
    return false;
  }
  
  for (const selected of selectedVectors) {
    if (!selected) {
      continue;
    }
    
    try {
      const similarity = cosineSimilarity(candidateVector, selected);
      if (similarity >= threshold) {
        return true;
      }
    } catch (error) {
      console.warn('Redundancy check failed for vector pair:', error);
    }
  }
  
  return false;
}

/**
 * Find the most similar vector from a set
 */
export function findMostSimilar(
  targetVector: Float32Array,
  candidates: Float32Array[]
): { index: number; similarity: number } | null {
  if (!candidates || candidates.length === 0) {
    return null;
  }
  
  let bestIndex = -1;
  let bestSimilarity = -1;
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) {
      continue;
    }
    
    try {
      const similarity = cosineSimilarity(targetVector, candidate);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    } catch (error) {
      console.warn('Similarity calculation failed for candidate vector:', error);
    }
  }
  
  return bestIndex >= 0 ? { index: bestIndex, similarity: bestSimilarity } : null;
}

/**
 * Calculate vector centroid (mean vector)
 */
export function calculateCentroid(vectors: Float32Array[]): Float32Array | null {
  if (!vectors || vectors.length === 0) {
    return null;
  }
  
  const validVectors = vectors.filter(v => v && v.length > 0);
  if (validVectors.length === 0) {
    return null;
  }
  
  const firstVector = validVectors[0];
  if (!firstVector) {
    return null;
  }
  
  const dimensions = firstVector.length;
  const centroid = new Float32Array(dimensions);
  
  // Sum all vectors
  for (const vector of validVectors) {
    if (!vector || vector.length !== dimensions) {
      console.warn('Vector dimension mismatch in centroid calculation');
      continue;
    }
    
    for (let i = 0; i < dimensions; i++) {
      const value = vector[i];
      const currentCentroid = centroid[i];
      if (value !== undefined && !isNaN(value) && currentCentroid !== undefined) {
        centroid[i] = currentCentroid + value;
      }
    }
  }
  
  // Normalize by count
  const count = validVectors.length;
  for (let i = 0; i < dimensions; i++) {
    const currentValue = centroid[i];
    if (count > 0 && currentValue !== undefined) {
      centroid[i] = currentValue / count;
    }
  }
  
  return centroid;
}

/**
 * Normalize vector to unit length
 */
export function normalizeVector(vector: Float32Array): Float32Array {
  if (!vector || vector.length === 0) {
    throw new Error('Cannot normalize empty vector');
  }
  
  const normalized = new Float32Array(vector.length);
  let magnitude = 0;
  
  // Calculate magnitude
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i];
    if (value !== undefined && !isNaN(value)) {
      magnitude += value * value;
    }
  }
  
  magnitude = Math.sqrt(magnitude);
  
  if (magnitude === 0) {
    // Return zero vector if input is zero
    return normalized;
  }
  
  // Normalize
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i];
    const normalizedValue = normalized[i];
    if (value !== undefined && !isNaN(value) && normalizedValue !== undefined) {
      normalized[i] = value / magnitude;
    }
  }
  
  return normalized;
}

/**
 * Calculate vector magnitude (Euclidean norm)
 */
export function vectorMagnitude(vector: Float32Array): number {
  if (!vector || vector.length === 0) {
    return 0;
  }
  
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i];
    if (value !== undefined && !isNaN(value)) {
      sumSquares += value * value;
    }
  }
  
  return Math.sqrt(sumSquares);
}

/**
 * Performance monitoring for vector operations
 */
interface VectorPerformanceMetrics {
  totalOperations: number;
  totalTimeMs: number;
  averageTimeMs: number;
  timeouts: number;
  errors: number;
}

let performanceMetrics: VectorPerformanceMetrics = {
  totalOperations: 0,
  totalTimeMs: 0,
  averageTimeMs: 0,
  timeouts: 0,
  errors: 0
};

/**
 * Get current performance metrics
 */
export function getVectorPerformanceMetrics(): VectorPerformanceMetrics {
  return { ...performanceMetrics };
}

/**
 * Reset performance metrics
 */
export function resetVectorPerformanceMetrics(): void {
  performanceMetrics = {
    totalOperations: 0,
    totalTimeMs: 0,
    averageTimeMs: 0,
    timeouts: 0,
    errors: 0
  };
}