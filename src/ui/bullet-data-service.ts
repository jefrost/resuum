/**
 * Bullet data service - storage operations (80 lines)
 */

import { getAll, create, update, getById } from '../storage/transactions';
import { queueBulletForEmbedding, markBulletChanged } from '../storage/embedding-state';
import { createId } from '../utils/uuid';
import type { Bullet, Role, Project, BulletFeatures } from '../types';

export class BulletDataService {
  private roles: Role[] = [];
  private projects: Project[] = [];

  async getBullet(bulletId: string): Promise<Bullet | null> {
    return getById<Bullet>('bullets', bulletId);
  }

  async createBullet(formData: any): Promise<void> {
    const roleId = await this.ensureRole(formData);
    const projectId = await this.ensureProject(formData, roleId);
    
    const bullet: Bullet = {
      id: createId('bullet'),
      roleId,
      projectId,
      text: formData.text,
      source: 'manual',
      normalizedFingerprint: `temp_${Date.now()}`,
      features: this.analyzeFeatures(formData.text),
      embeddingState: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
      lastModified: Date.now()
    };
    
    await create('bullets', bullet);
    await queueBulletForEmbedding(bullet.id);
  }

  async updateBullet(bulletId: string, formData: any): Promise<void> {
    const existingBullet = await getById<Bullet>('bullets', bulletId);
    if (!existingBullet) throw new Error('Bullet not found');
    
    const roleId = await this.ensureRole(formData);
    const projectId = await this.ensureProject(formData, roleId);
    
    const updatedBullet: Bullet = {
      ...existingBullet,
      text: formData.text,
      roleId,
      projectId,
      features: this.analyzeFeatures(formData.text),
      lastModified: Date.now()
    };
    
    await update('bullets', updatedBullet);
    
    if (existingBullet.text !== formData.text) {
      await markBulletChanged(bulletId);
    }
  }

  private async ensureRole(data: any): Promise<string> {
    if (data.roleId !== 'new_role') return data.roleId;
    
    await this.loadRoles();
    
    const newRole: Role = {
      id: createId('role'),
      title: data.newRoleTitle,
      company: data.newRoleCompany,
      orderIndex: this.roles.length,
      bulletsLimit: 3,
      startDate: new Date().toISOString().slice(0, 7),
      endDate: null
    };
    
    await create('roles', newRole);
    this.roles.push(newRole);
    
    return newRole.id;
  }

  private async ensureProject(data: any, roleId: string): Promise<string> {
    if (data.projectId !== 'new_project') {
      return data.projectId || `no_project_${roleId}`;
    }
    
    await this.loadProjects();
    
    const newProject: Project = {
      id: createId('project'),
      roleId,
      name: data.newProjectName,
      description: data.newProjectDescription || '',
      centroidVector: new ArrayBuffer(0),
      vectorDimensions: 0,
      bulletCount: 0,
      embeddingVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await create('projects', newProject);
    this.projects.push(newProject);
    
    return newProject.id;
  }

  private analyzeFeatures(text: string): BulletFeatures {
    const wordCount = text.trim().split(/\s+/).length;
    
    return {
      hasNumbers: /\d/.test(text),
      actionVerb: /^(led|managed|developed|created|built|achieved|analyzed|designed|implemented)/i.test(text.trim()),
      lengthOk: wordCount >= 5 && wordCount <= 22
    };
  }

  private async loadRoles(): Promise<void> {
    if (this.roles.length === 0) {
      this.roles = await getAll<Role>('roles');
    }
  }

  private async loadProjects(): Promise<void> {
    if (this.projects.length === 0) {
      this.projects = await getAll<Project>('projects');
    }
  }
}