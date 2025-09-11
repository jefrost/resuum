/**
 * Bullet Selector
 * Applies business rules for final bullet selection
 */

import type { Role } from '../types';
import type { ScoredBullet } from './claude-ranking-engine';
import { calculateWordOverlapSimilarity, createFingerprint, areDuplicates } from '../utils/text-similarity';

// ============================================================================
// Bullet Selector
// ============================================================================

export class BulletSelector {
  
  /**
   * Apply business rules and select final bullets
   */
  selectFinalBullets(bullets: ScoredBullet[], roles: Role[]): ScoredBullet[] {
    // Sort by normalized score
    bullets.sort((a, b) => b.normalizedScore - a.normalizedScore);

    const selected: ScoredBullet[] = [];
    const usedProjects = new Set<string>();
    const roleUsage = new Map<string, number>();

    // Initialize role tracking
    for (const role of roles) {
      roleUsage.set(role.id, 0);
    }

    for (const bullet of bullets) {
      // Check role limit
      const role = roles.find(r => r.id === bullet.roleId);
      const roleLimit = role?.bulletsLimit || 3;
      const currentUsage = roleUsage.get(bullet.roleId) || 0;

      if (currentUsage >= roleLimit) continue;

      // Check project diversity (max 1 per project)
      if (usedProjects.has(bullet.projectId)) continue;

      // Check redundancy using shared similarity function
      if (this.isRedundant(bullet, selected)) continue;

      // Check duplicate fingerprints using shared function
      if (this.hasDuplicateFingerprint(bullet, selected)) continue;

      // Add to selection
      selected.push(bullet);
      usedProjects.add(bullet.projectId);
      roleUsage.set(bullet.roleId, currentUsage + 1);
    }

    return this.sortDeterministically(selected);
  }

  /**
   * Check if bullet is redundant with selected bullets
   */
  private isRedundant(bullet: ScoredBullet, selected: ScoredBullet[]): boolean {
    for (const existing of selected) {
      // Use shared similarity function with 0.75 threshold
      if (calculateWordOverlapSimilarity(bullet.text, existing.text) > 0.75) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check for duplicate normalized fingerprints
   */
  private hasDuplicateFingerprint(bullet: ScoredBullet, selected: ScoredBullet[]): boolean {
    const fingerprint = createFingerprint(bullet.text);
    
    for (const existing of selected) {
      if (createFingerprint(existing.text) === fingerprint) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Alternative: Use the comprehensive duplicate check
   */
  private isDuplicate(bullet: ScoredBullet, selected: ScoredBullet[]): boolean {
    for (const existing of selected) {
      if (areDuplicates(bullet.text, existing.text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Apply deterministic sorting for stable results
   */
  private sortDeterministically(bullets: ScoredBullet[]): ScoredBullet[] {
    return bullets.sort((a, b) => {
      // Primary: score descending
      if (Math.abs(a.normalizedScore - b.normalizedScore) > 0.001) {
        return b.normalizedScore - a.normalizedScore;
      }
      
      // Secondary: prefer quantified bullets
      const aQuantified = this.hasNumbers(a.text) ? 1 : 0;
      const bQuantified = this.hasNumbers(b.text) ? 1 : 0;
      if (aQuantified !== bQuantified) {
        return bQuantified - aQuantified;
      }
      
      // Tertiary: lexicographic by ID for stability
      return a.bulletId.localeCompare(b.bulletId);
    });
  }

  private hasNumbers(text: string): boolean {
    return /\d/.test(text);
  }
}