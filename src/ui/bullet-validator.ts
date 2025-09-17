/**
 * Bullet Point Validation Service
 * Simplified validation for AI-analysis approach
 */

import type { Bullet } from '../types';

// ============================================================================
// Validation Rules
// ============================================================================

const VALIDATION_RULES = {
  minLength: 10,
  maxLength: 500,
  maxWords: 75
};

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Bullet Validator Class
// ============================================================================

export class BulletValidator {
  /**
   * Validate bullet point text
   */
  validateText(text: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!text || typeof text !== 'string') {
      errors.push('Bullet point text is required');
      return { isValid: false, errors, warnings };
    }

    const trimmedText = text.trim();

    // Length validation
    if (trimmedText.length === 0) {
      errors.push('Bullet point cannot be empty');
    } else if (trimmedText.length < VALIDATION_RULES.minLength) {
      errors.push(`Bullet point should be at least ${VALIDATION_RULES.minLength} characters long`);
    } else if (trimmedText.length > VALIDATION_RULES.maxLength) {
      errors.push(`Bullet point should be less than ${VALIDATION_RULES.maxLength} characters long`);
    }

    // Word count validation
    const wordCount = trimmedText.split(/\s+/).length;
    if (wordCount > VALIDATION_RULES.maxWords) {
      warnings.push(`Bullet point has ${wordCount} words. Consider keeping it under ${VALIDATION_RULES.maxWords} words for readability`);
    }

    // Basic format checks
    if (trimmedText.length > 0) {
      // Check for basic sentence structure
      if (!trimmedText.match(/^[A-Z]/) && !trimmedText.match(/^[0-9]/)) {
        warnings.push('Consider starting with a capital letter or number');
      }

      // Check for extremely short sentences
      if (wordCount < 5) {
        warnings.push('Bullet point seems very short. Consider adding more detail about your impact');
      }

      // Check for common formatting issues
      if (trimmedText.includes('  ')) {
        warnings.push('Remove extra spaces between words');
      }

      if (trimmedText.startsWith('•') || trimmedText.startsWith('-')) {
        warnings.push('Remove bullet symbols - they will be added automatically');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete bullet data
   */
  validateBullet(bulletData: {
    text: string;
    roleId: string;
    projectId: string;
  }): ValidationResult {
    const textValidation = this.validateText(bulletData.text);
    const errors = [...textValidation.errors];
    const warnings = [...textValidation.warnings];

    // Validate required fields
    if (!bulletData.roleId || bulletData.roleId.trim().length === 0) {
      errors.push('Role selection is required');
    }

    if (!bulletData.projectId || bulletData.projectId.trim().length === 0) {
      errors.push('Project selection is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for potential duplicates
   */
  checkForDuplicates(newText: string, existingBullets: Bullet[]): {
    hasDuplicates: boolean;
    similarBullets: Array<{ bullet: Bullet; similarity: number }>;
  } {
    const normalizedNew = this.normalizeText(newText);
    const similarBullets: Array<{ bullet: Bullet; similarity: number }> = [];

    for (const bullet of existingBullets) {
      const normalizedExisting = this.normalizeText(bullet.text);
      const similarity = this.calculateTextSimilarity(normalizedNew, normalizedExisting);
      
      if (similarity > 0.8) {
        similarBullets.push({ bullet, similarity });
      }
    }

    return {
      hasDuplicates: similarBullets.length > 0,
      similarBullets: similarBullets.sort((a, b) => b.similarity - a.similarity)
    };
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Calculate simple text similarity (Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Get validation suggestions
   */
  getImprovementSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return ['Add meaningful content describing your accomplishment or responsibility'];
    }

    // Check for action verbs
    const startsWithActionVerb = /^(Led|Managed|Developed|Created|Implemented|Analyzed|Designed|Built|Optimized|Increased|Decreased|Improved|Reduced|Achieved|Delivered|Coordinated|Established|Generated|Streamlined)/i.test(trimmedText);
    
    if (!startsWithActionVerb) {
      suggestions.push('Consider starting with a strong action verb (Led, Developed, Implemented, etc.)');
    }

    // Check for numbers/metrics
    const hasNumbers = /\d/.test(trimmedText);
    if (!hasNumbers) {
      suggestions.push('Consider adding specific numbers or metrics to quantify your impact');
    }

    // Check for impact/results
    const hasImpactWords = /(result|impact|effect|outcome|improvement|increase|decrease|saving|revenue|efficiency)/i.test(trimmedText);
    if (!hasImpactWords) {
      suggestions.push('Consider adding the impact or results of your work');
    }

    return suggestions;
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalBulletValidator: BulletValidator | null = null;

/**
 * Get global bullet validator instance
 */
export function getBulletValidator(): BulletValidator {
  if (!globalBulletValidator) {
    globalBulletValidator = new BulletValidator();
  }
  return globalBulletValidator;
}