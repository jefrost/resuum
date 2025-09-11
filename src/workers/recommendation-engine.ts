/**
 * Recommendation Engine
 * AI-powered bullet point recommendations using Claude
 */

import { getAll } from '../storage/transactions';
import { ClaudeRankingEngine } from './claude-ranking-engine';
import type { Role, Project, Bullet, RecommendationResult, RoleResult, BulletResult } from '../types';

// ============================================================================
// Recommendation Engine Class
// ============================================================================

export class RecommendationEngine {
  private claudeEngine: ClaudeRankingEngine;

  constructor() {
    this.claudeEngine = new ClaudeRankingEngine();
  }

  /**
   * Generate recommendations for a job application
   */
  async generateRecommendations(
    jobTitle: string,
    jobDescription: string,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    
    // Validate inputs
    if (!jobTitle.trim() || !jobDescription.trim()) {
      throw new Error('Job title and description are required');
    }
    
    // Check if user has experience data
    await this.validateUserHasExperience();
    
    try {
      onProgress?.('Loading experience data...', 0.05);
      
      // Load user's experience data
      const experienceData = await this.loadExperienceData();
      
      onProgress?.('Starting AI analysis...', 0.1);
      
      // Use Claude ranking engine for the heavy lifting
      const scoredBullets = await this.claudeEngine.rankBullets(
        jobTitle,
        jobDescription,
        experienceData.bullets,
        experienceData.roles,
        onProgress
      );
      
      onProgress?.('Organizing results...', 0.95);
      
      // Convert to expected result format
      const roleResults = this.convertToRoleResults(scoredBullets, experienceData);
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        jobTitle: jobTitle.trim(),
        totalBullets: scoredBullets.length,
        processingTime,
        roleResults
      };
      
    } catch (error) {
      throw new Error(`Recommendation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate user has experience data
   */
  private async validateUserHasExperience(): Promise<void> {
    const [roles, bullets] = await Promise.all([
      getAll<Role>('roles'),
      getAll<Bullet>('bullets')
    ]);
    
    if (roles.length === 0) {
      throw new Error('You must add roles first. Please add your work experience in the Experience tab.');
    }
    
    if (bullets.length === 0) {
      throw new Error('You must add bullet points first. Please add bullet points for your roles in the Experience tab.');
    }
  }

  /**
   * Load user's experience data
   */
  private async loadExperienceData(): Promise<{
    roles: Role[];
    projects: Project[];
    bullets: Bullet[];
  }> {
    const [roles, projects, bullets] = await Promise.all([
      getAll<Role>('roles'),
      getAll<Project>('projects'),
      getAll<Bullet>('bullets')
    ]);
    
    return { roles, projects, bullets };
  }

  /**
   * Convert scored bullets to role-based results format
   */
  private convertToRoleResults(
    scoredBullets: any[],
    experienceData: { roles: Role[]; projects: Project[]; bullets: Bullet[] }
  ): RoleResult[] {
    const roleResults: RoleResult[] = [];
    
    // Group scored bullets by role
    const bulletsByRole = new Map<string, any[]>();
    for (const scoredBullet of scoredBullets) {
      if (!bulletsByRole.has(scoredBullet.roleId)) {
        bulletsByRole.set(scoredBullet.roleId, []);
      }
      bulletsByRole.get(scoredBullet.roleId)!.push(scoredBullet);
    }
    
    // Create role results
    for (const [roleId, bullets] of bulletsByRole) {
      const role = experienceData.roles.find(r => r.id === roleId);
      if (!role) continue;
      
      // Convert to BulletResult format
      const selectedBullets: BulletResult[] = bullets.map(scoredBullet => {
        const project = experienceData.projects.find(p => p.id === scoredBullet.projectId);
        
        return {
          bulletId: scoredBullet.bulletId,
          text: scoredBullet.text,
          relevanceScore: scoredBullet.normalizedScore,
          projectName: project?.name || 'Unknown Project',
          matchedSkills: scoredBullet.skillHits || []
        };
      });
      
      // Calculate average relevance
      const avgRelevance = selectedBullets.length > 0 
        ? selectedBullets.reduce((sum, b) => sum + b.relevanceScore, 0) / selectedBullets.length
        : 0;
      
      // Get unique projects used
      const projectsUsed = [...new Set(selectedBullets.map(b => b.projectName))];
      
      roleResults.push({
        roleId: role.id,
        roleTitle: `${role.title} (${role.company})`,
        selectedBullets,
        projectsUsed,
        avgRelevance
      });
    }
    
    // Sort roles by order index (most recent first)
    roleResults.sort((a, b) => {
      const roleA = experienceData.roles.find(r => r.id === a.roleId);
      const roleB = experienceData.roles.find(r => r.id === b.roleId);
      return (roleA?.orderIndex || 0) - (roleB?.orderIndex || 0);
    });
    
    return roleResults;
  }
}