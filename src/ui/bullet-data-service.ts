/**
 * Bullet Data Service
 * Manages bullet point data operations (simplified for AI analysis)
 */

import { getAll, getById, create, update, deleteById } from '../storage/transactions';
import type { Bullet, Role, Project } from '../types';

// ============================================================================
// Bullet Data Service Class
// ============================================================================

export class BulletDataService {
  /**
   * Get all bullet points
   */
  async getAllBullets(): Promise<Bullet[]> {
    return getAll<Bullet>('bullets');
  }

  /**
   * Get bullet points by role
   */
  async getBulletsByRole(roleId: string): Promise<Bullet[]> {
    const allBullets = await this.getAllBullets();
    return allBullets.filter(bullet => bullet.roleId === roleId);
  }

  /**
   * Get bullet points by project
   */
  async getBulletsByProject(projectId: string): Promise<Bullet[]> {
    const allBullets = await this.getAllBullets();
    return allBullets.filter(bullet => bullet.projectId === projectId);
  }

  /**
   * Create new bullet point
   */
  async createBullet(bulletData: {
    roleId: string;
    projectId: string;
    text: string;
    source?: 'manual' | 'resume_import';
  }): Promise<Bullet> {
    const bullet: Bullet = {
      id: `bullet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roleId: bulletData.roleId,
      projectId: bulletData.projectId,
      text: bulletData.text.trim(),
      source: bulletData.source || 'manual',
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    return create('bullets', bullet);
  }

  /**
   * Update bullet point
   */
  async updateBullet(bulletId: string, updates: {
    text?: string;
    projectId?: string;
  }): Promise<Bullet> {
    const existingBullet = await getById<Bullet>('bullets', bulletId);
    if (!existingBullet) {
      throw new Error(`Bullet with id ${bulletId} not found`);
    }

    const updatedBullet: Bullet = {
      ...existingBullet,
      ...updates,
      lastModified: Date.now()
    };

    if (updates.text) {
      updatedBullet.text = updates.text.trim();
    }

    return update('bullets', updatedBullet);
  }

  /**
   * Delete bullet point
   */
  async deleteBullet(bulletId: string): Promise<void> {
    await deleteById('bullets', bulletId);
  }

  /**
   * Get bullets with role and project context
   */
  async getBulletsWithContext(): Promise<Array<{
    bullet: Bullet;
    role: Role | null;
    project: Project | null;
  }>> {
    const [bullets, roles, projects] = await Promise.all([
      this.getAllBullets(),
      getAll<Role>('roles'),
      getAll<Project>('projects')
    ]);

    return bullets.map(bullet => ({
      bullet,
      role: roles.find(r => r.id === bullet.roleId) || null,
      project: projects.find(p => p.id === bullet.projectId) || null
    }));
  }

  /**
   * Validate bullet point data
   */
  validateBulletData(text: string, roleId: string, projectId: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!text || text.trim().length === 0) {
      errors.push('Bullet point text is required');
    }

    if (text && text.trim().length < 10) {
      errors.push('Bullet point should be at least 10 characters long');
    }

    if (text && text.trim().length > 500) {
      errors.push('Bullet point should be less than 500 characters');
    }

    if (!roleId) {
      errors.push('Role is required');
    }

    if (!projectId) {
      errors.push('Project is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Search bullets by text
   */
  async searchBullets(searchTerm: string): Promise<Bullet[]> {
    const allBullets = await this.getAllBullets();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return allBullets.filter(bullet =>
      bullet.text.toLowerCase().includes(lowerSearchTerm)
    );
  }

  /**
   * Get bullet statistics
   */
  async getBulletStats(): Promise<{
    totalBullets: number;
    bulletsByRole: Array<{ roleId: string; count: number }>;
    bulletsByProject: Array<{ projectId: string; count: number }>;
  }> {
    const bullets = await this.getAllBullets();
    
    const bulletsByRole = bullets.reduce((acc, bullet) => {
      const existing = acc.find(item => item.roleId === bullet.roleId);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ roleId: bullet.roleId, count: 1 });
      }
      return acc;
    }, [] as Array<{ roleId: string; count: number }>);

    const bulletsByProject = bullets.reduce((acc, bullet) => {
      const existing = acc.find(item => item.projectId === bullet.projectId);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ projectId: bullet.projectId, count: 1 });
      }
      return acc;
    }, [] as Array<{ projectId: string; count: number }>);

    return {
      totalBullets: bullets.length,
      bulletsByRole,
      bulletsByProject
    };
  }
}

// ============================================================================
// Global Service Instance
// ============================================================================

let globalBulletDataService: BulletDataService | null = null;

/**
 * Get global bullet data service instance
 */
export function getBulletDataService(): BulletDataService {
  if (!globalBulletDataService) {
    globalBulletDataService = new BulletDataService();
  }
  return globalBulletDataService;
}