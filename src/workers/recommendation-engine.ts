/**
 * Recommendation Engine
 * AI-powered bullet point recommendations (placeholder for Step 10 implementation)
 */

import { getAll } from '../storage/transactions';
import { getJobAnalyzer } from './job-analyzer';
import type { Role, Project, Bullet, JobAnalysis, RecommendationResult, RoleResult, BulletResult } from '../types';

// ============================================================================
// Recommendation Engine Class
// ============================================================================

export class RecommendationEngine {
  /**
   * Generate recommendations for a job application
   */
  async generateRecommendations(
    jobTitle: string,
    jobDescription: string
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    
    // Validate inputs
    if (!jobTitle.trim() || !jobDescription.trim()) {
      throw new Error('Job title and description are required');
    }
    
    // Check if user has experience data
    await this.validateUserHasExperience();
    
    try {
      // Step 1: Analyze job requirements using AI
      const jobAnalysis = await this.analyzeJobRequirements(jobTitle, jobDescription);
      
      // Step 2: Load user's experience data
      const experienceData = await this.loadExperienceData();
      
      // Step 3: Evaluate bullets against job requirements using AI
      const evaluatedBullets = await this.evaluateBullets(jobAnalysis, experienceData);
      
      // Step 4: Select best bullets for each role respecting limits
      const roleResults = await this.selectOptimalBullets(evaluatedBullets, experienceData.roles);
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        jobTitle: jobTitle.trim(),
        totalBullets: roleResults.reduce((sum, role) => sum + role.selectedBullets.length, 0),
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
    
    if (roles.length === 0 || bullets.length === 0) {
      throw new Error('You must add experience first. Please add roles and bullet points in the Experience tab before generating recommendations.');
    }
  }

  /**
   * Analyze job requirements using AI
   */
  private async analyzeJobRequirements(title: string, description: string): Promise<JobAnalysis> {
    const jobAnalyzer = getJobAnalyzer();
    return await jobAnalyzer.analyzeJob(title, description);
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
   * Evaluate bullets against job requirements using AI
   * TODO: Implement AI-powered bullet evaluation
   */
  private async evaluateBullets(
    jobAnalysis: JobAnalysis,
    experienceData: { roles: Role[]; projects: Project[]; bullets: Bullet[] }
  ): Promise<Array<{
    bullet: Bullet;
    role: Role;
    project: Project | null;
    relevanceScore: number;
    matchedSkills: string[];
    reasoning: string;
  }>> {
    // TODO: Replace with actual AI evaluation
    // For now, return mock evaluation data
    return experienceData.bullets.map(bullet => {
      const role = experienceData.roles.find(r => r.id === bullet.roleId)!;
      const project = experienceData.projects.find(p => p.id === bullet.projectId) || null;
      
      return {
        bullet,
        role,
        project,
        relevanceScore: Math.random() * 0.3 + 0.7, // Mock score between 0.7-1.0
        matchedSkills: jobAnalysis.extractedSkills.slice(0, 2), // Mock matched skills
        reasoning: 'Mock reasoning - this would be AI-generated explanation of relevance'
      };
    });
  }

  /**
   * Select optimal bullets for each role respecting limits
   */
  private async selectOptimalBullets(
    evaluatedBullets: Array<{
      bullet: Bullet;
      role: Role;
      project: Project | null;
      relevanceScore: number;
      matchedSkills: string[];
      reasoning: string;
    }>,
    roles: Role[]
  ): Promise<RoleResult[]> {
    const roleResults: RoleResult[] = [];
    
    for (const role of roles) {
      const roleBullets = evaluatedBullets
        .filter(eb => eb.role.id === role.id)
        .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance descending
        .slice(0, role.bulletsLimit); // Respect role bullet limit
      
      if (roleBullets.length > 0) {
        const selectedBullets: BulletResult[] = roleBullets.map(eb => ({
          bulletId: eb.bullet.id,
          text: eb.bullet.text,
          relevanceScore: eb.relevanceScore,
          projectName: eb.project?.name || 'Unknown Project',
          matchedSkills: eb.matchedSkills
        }));
        
        const projectsUsed = [...new Set(roleBullets
          .map(eb => eb.project?.name)
          .filter(name => name)
        )] as string[];
        
        const avgRelevance = roleBullets.reduce((sum, eb) => sum + eb.relevanceScore, 0) / roleBullets.length;
        
        roleResults.push({
          roleId: role.id,
          roleTitle: `${role.title} at ${role.company}`,
          selectedBullets,
          projectsUsed,
          avgRelevance
        });
      }
    }
    
    // Sort role results by average relevance (most relevant first)
    return roleResults.sort((a, b) => b.avgRelevance - a.avgRelevance);
  }

  /**
   * Refresh recommendations with same job data
   */
  async refreshRecommendations(lastJobTitle: string, lastJobDescription: string): Promise<RecommendationResult> {
    return this.generateRecommendations(lastJobTitle, lastJobDescription);
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalRecommendationEngine: RecommendationEngine | null = null;

/**
 * Get global recommendation engine instance
 */
export function getRecommendationEngine(): RecommendationEngine {
  if (!globalRecommendationEngine) {
    globalRecommendationEngine = new RecommendationEngine();
  }
  return globalRecommendationEngine;
}