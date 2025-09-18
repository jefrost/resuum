/**
 * Bullet Selector
 * Applies business rules for final bullet selection with flexible diversity
 */

import type { Role } from '../types';
import type { ScoredBullet } from './openai-ranking-engine';
import { calculateWordOverlapSimilarity, createFingerprint, areDuplicates } from '../utils/text-similarity';

// ============================================================================
// Bullet Selector
// ============================================================================

export class BulletSelector {
  
  /**
   * Apply business rules and select final bullets with flexible project diversity
   */
  selectFinalBullets(bullets: ScoredBullet[], roles: Role[]): ScoredBullet[] {
    // Sort by normalized score
    bullets.sort((a, b) => b.normalizedScore - a.normalizedScore);

    // Group bullets by role for diversity-aware selection
    const bulletsByRole = new Map<string, ScoredBullet[]>();
    for (const bullet of bullets) {
      if (!bulletsByRole.has(bullet.roleId)) {
        bulletsByRole.set(bullet.roleId, []);
      }
      bulletsByRole.get(bullet.roleId)!.push(bullet);
    }

    const allSelected: ScoredBullet[] = [];

    // Process each role separately with diversity logic
    for (const [roleId, roleBullets] of bulletsByRole) {
      const role = roles.find(r => r.id === roleId);
      const roleLimit = role?.bulletsLimit || 3;
      
      console.log(`Processing role ${roleId} with ${roleBullets.length} bullets, limit: ${roleLimit}`);
      
      const roleSelected = this.selectBulletsForRole(roleBullets, roleLimit);
      
      console.log(`Selected ${roleSelected.length} bullets for role ${roleId}`);
      
      // Add bullets that pass global redundancy checks
      for (const bullet of roleSelected) {
        if (allSelected.length >= 50) break; // Global limit
        
        // Check redundancy against all previously selected bullets
        if (this.isRedundant(bullet, allSelected)) {
          console.log(`Bullet ${bullet.bulletId} rejected for redundancy`);
          continue;
        }
        if (this.hasDuplicateFingerprint(bullet, allSelected)) {
          console.log(`Bullet ${bullet.bulletId} rejected for duplicate fingerprint`);
          continue;
        }
        
        console.log(`Adding bullet ${bullet.bulletId} to final selection`);
        allSelected.push(bullet);
      }
    }

    console.log(`Final selection: ${allSelected.length} bullets`);
    return this.sortDeterministically(allSelected);
  }

  /**
   * Select bullets for a single role with diversity priority
   */
  private selectBulletsForRole(roleBullets: ScoredBullet[], roleLimit: number): ScoredBullet[] {
    if (roleBullets.length === 0 || roleLimit === 0) return [];
    
    // Group by project
    const bulletsByProject = new Map<string, ScoredBullet[]>();
    for (const bullet of roleBullets) {
      if (!bulletsByProject.has(bullet.projectId)) {
        bulletsByProject.set(bullet.projectId, []);
      }
      bulletsByProject.get(bullet.projectId)!.push(bullet);
    }

    // Sort bullets within each project by score (highest first)
    for (const [_, projectBullets] of bulletsByProject) {
      projectBullets.sort((a, b) => b.normalizedScore - a.normalizedScore);
    }

    const selected: ScoredBullet[] = [];
    const projects = Array.from(bulletsByProject.keys());
    
    console.log(`Role has ${projects.length} projects, limit is ${roleLimit}`);

    // Phase 1: Diversity - try to get one bullet from each project
    for (const projectId of projects) {
      if (selected.length >= roleLimit) break;
      
      const projectBullets = bulletsByProject.get(projectId)!;
      if (projectBullets.length > 0) {
        if (projectBullets[0]) {
          selected.push(projectBullets[0]); // Best bullet from this project
        }
        console.log(`Phase 1: Added bullet from project ${projectId}`);
      }
    }

    // Phase 2: Fill remaining slots with best available bullets
    if (selected.length < roleLimit) {
      console.log(`Phase 2: Need ${roleLimit - selected.length} more bullets`);
      
      // Create a list of remaining bullets (not yet selected)
      const remaining: ScoredBullet[] = [];
      
      for (const [projectId, projectBullets] of bulletsByProject) {
        // Skip the first bullet from each project (already selected in Phase 1)
        const startIndex = selected.some(s => s.projectId === projectId) ? 1 : 0;
        remaining.push(...projectBullets.slice(startIndex));
      }
      
      // Sort remaining bullets by score
      remaining.sort((a, b) => b.normalizedScore - a.normalizedScore);
      
      // Add best remaining bullets until we reach the limit
      for (const bullet of remaining) {
        if (selected.length >= roleLimit) break;
        selected.push(bullet);
        console.log(`Phase 2: Added additional bullet from project ${bullet.projectId}`);
      }
    }

    console.log(`Role selection complete: ${selected.length} bullets from ${new Set(selected.map(b => b.projectId)).size} projects`);
    return selected;
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
   * Check for duplicate fingerprints using shared function
   */
  private hasDuplicateFingerprint(bullet: ScoredBullet, selected: ScoredBullet[]): boolean {
    const bulletFingerprint = createFingerprint(bullet.text);
    
    for (const existing of selected) {
      const existingFingerprint = createFingerprint(existing.text);
      if (areDuplicates(bulletFingerprint, existingFingerprint)) {
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