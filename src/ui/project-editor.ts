/**
 * Project Editor Modal
 * Simplified to use ProjectFormBuilder
 */

import { getAll, create, update, getById, deleteById } from '../storage/transactions';
import { createSafeElement } from './xss-safe-rendering';
import { createId } from '../utils/uuid';
import { ProjectFormBuilder } from './project-form-builder';
import type { Project, Bullet } from '../types';

export class ProjectEditor {
  private modal: HTMLElement | null = null;
  private currentProjectId: string | null = null;
  private onSave?: (() => void) | undefined;
  private formBuilder: ProjectFormBuilder;

  constructor() {
    this.formBuilder = new ProjectFormBuilder();
  }

  async showAddModal(defaultRoleId?: string, onSave?: () => void): Promise<void> {
    this.currentProjectId = null;
    this.onSave = onSave;
    
    await this.showModal({
      title: 'Add Project',
      project: null,
      bullets: [],
      isEdit: false,
      ...(defaultRoleId && { defaultRoleId })
    });
  }

  async showEditModal(projectId: string, onSave?: () => void): Promise<void> {
    this.currentProjectId = projectId;
    this.onSave = onSave;
    
    const project = await getById<Project>('projects', projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const bullets = await this.loadProjectBullets(projectId);
    
    await this.showModal({
      title: 'Edit Project',
      project,
      bullets,
      isEdit: true,
      defaultRoleId: project.roleId
    });
  }

  private async loadProjectBullets(projectId: string): Promise<Bullet[]> {
    const allBullets = await getAll<Bullet>('bullets');
    const projectBullets = allBullets.filter(bullet => bullet.projectId === projectId);
    return projectBullets.sort((a, b) => a.createdAt - b.createdAt);
  }

  private async showModal(config: {
    title: string;
    project: Project | null;
    bullets: Bullet[];
    isEdit: boolean;
    defaultRoleId?: string;
  }): Promise<void> {
    this.hideModal();
    
    this.modal = this.createModalStructure(config.title);
    const formConfig = {
      project: config.project,
      bullets: config.bullets,
      isEdit: config.isEdit,
      ...(config.defaultRoleId && { defaultRoleId: config.defaultRoleId })
    };
    
    const form = await this.formBuilder.createForm(
      formConfig,
      (data) => this.handleSubmit(data),
      () => this.hideModal()
    );
    
    this.modal.querySelector('.modal-body')!.appendChild(form);
    this.showModalElement();
  }

  private createModalStructure(title: string): HTMLElement {
    const modal = createSafeElement('div', '', 'modal-overlay');
    const content = createSafeElement('div', '', 'modal-content project-editor-modal');
    const header = createSafeElement('div', '', 'modal-header');
    const titleEl = createSafeElement('h3', title);
    const closeBtn = createSafeElement('button', '×', 'modal-close');
    const body = createSafeElement('div', '', 'modal-body');
    
    closeBtn.onclick = () => this.hideModal();
    header.append(titleEl, closeBtn);
    content.append(header, body);
    modal.appendChild(content);
    
    return modal;
  }

  private showModalElement(): void {
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(this.modal!);
    
    setTimeout(() => {
      const firstInput = this.modal!.querySelector('input, textarea') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
    
    document.onkeydown = (e) => {
      if (e.key === 'Escape') {
        this.hideModal();
      }
    };
  }

  private async handleSubmit(formData: any): Promise<void> {
    try {
      if (this.currentProjectId) {
        await this.updateProject(formData);
        await this.updateProjectBullets(formData);
      } else {
        const project = await this.createProject(formData);
        await this.createProjectBullets(formData, project.id);
      }
      
      this.hideModal();
      this.onSave?.();
      
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
    }
  }

  private async createProject(formData: any): Promise<Project> {
    const newProject: Project = {
      id: createId('project'),
      roleId: formData.roleId,
      name: formData.name,
      description: formData.description,
      bulletCount: formData.bulletTexts.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    return await create('projects', newProject);
  }

  private async updateProject(formData: any): Promise<void> {
    if (!this.currentProjectId) return;
    
    const existingProject = await getById<Project>('projects', this.currentProjectId);
    if (!existingProject) {
      throw new Error('Project not found');
    }
    
    const updatedProject: Project = {
      ...existingProject,
      roleId: formData.roleId,
      name: formData.name,
      description: formData.description,
      bulletCount: formData.bulletTexts.length,
      updatedAt: Date.now()
    };
    
    await update('projects', updatedProject);
  }

  private async createProjectBullets(formData: any, projectId: string): Promise<void> {
    for (const bulletText of formData.bulletTexts) {
      const newBullet: Bullet = {
        id: createId('bullet'),
        roleId: formData.roleId,
        projectId: projectId,
        text: bulletText,
        source: 'manual',
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      
      await create('bullets', newBullet);
    }
  }

  private async updateProjectBullets(formData: any): Promise<void> {
    if (!this.currentProjectId) return;
    
    // Delete existing bullets and recreate
    const existingBullets = await this.loadProjectBullets(this.currentProjectId);
    for (const bullet of existingBullets) {
      await deleteById('bullets', bullet.id);
    }
    
    await this.createProjectBullets(formData, this.currentProjectId);
  }

  hideModal(): void {
    this.modal?.remove();
    this.modal = null;
    this.currentProjectId = null;
    this.onSave = undefined;
    document.onkeydown = null;
  }
}

let globalProjectEditor: ProjectEditor | null = null;

export function getProjectEditor(): ProjectEditor {
  if (!globalProjectEditor) {
    globalProjectEditor = new ProjectEditor();
  }
  return globalProjectEditor;
}