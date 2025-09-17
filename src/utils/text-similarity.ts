/**
 * Text Similarity Utilities
 * Simple similarity functions for bullet comparison
 */

// ============================================================================
// Core Similarity Functions (Used by bullet-selector)
// ============================================================================

/**
 * Calculate word overlap similarity between two texts
 */
export function calculateWordOverlapSimilarity(text1: string, text2: string): number {
    const words1 = new Set(normalizeWords(text1));
    const words2 = new Set(normalizeWords(text2));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Create normalized fingerprint for exact duplicate detection
   */
  export function createFingerprint(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\d+/g, '<NUM>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Check if two texts are likely duplicates
   */
  export function areDuplicates(text1: string, text2: string): boolean {
    // Check fingerprint first (exact duplicates)
    if (createFingerprint(text1) === createFingerprint(text2)) {
      return true;
    }
    
    // Check high word overlap
    const wordSim = calculateWordOverlapSimilarity(text1, text2);
    return wordSim > 0.8;
  }
  
  // ============================================================================
  // Utility Functions
  // ============================================================================
  
  /**
   * Normalize text to words for comparison
   */
  function normalizeWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter short words
      .filter(word => !isStopWord(word));
  }
  
  /**
   * Check if word is a common stop word
   */
  function isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'was', 'were', 'been', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'shall', 'this', 'that', 'these', 'those'
    ]);
    
    return stopWords.has(word);
  }