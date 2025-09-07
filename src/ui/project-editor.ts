/**
 * Project editor modal
 */

import { getAll, create, update, getById } from '../storage/transactions';
import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { createId } from '../utils/uuid';
import type { Project, Role } from '../types';

export class ProjectEditor {
  private modal: HTMLElement | null = null;
  private currentProjectId: string | null = null;
  private onSave?: (() => void) | undefined;
  private roles: Role[] = [];

  /**
   * Show editor for new project
   */
  async showAddModal(defaultRoleId?: string, onSave?: () => void): Promise<void> {
    this.currentProjectId = null;
    this.onSave = onSave;
    
    await this.loadRoles();
    
    await this.showModal({
      title: 'Add Project',
      project: null,
      ...(defaultRoleId && { defaultRoleId })
    });
    
  }

  /**
   * Show editor for existing project
   */
  async showEditModal(projectId: string, onSave?: () => void): Promise<void> {
    this.currentProjectId = projectId;
    this.onSave = onSave;
    
    await this.loadRoles();
    
    const project = await getById<Project>('projects', projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    await this.showModal({
      title: 'Edit Project',
      project,
      defaultRoleId: project.roleId
    });
  }

  /**
   * Load roles data
   */
  private async loadRoles(): Promise<void> {
    this.roles = await getAll<Role>('roles');
    this.roles.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  /**
   * Show the modal with form
   */
  private async showModal(config: {
    title: string;
    project: Project | null;
    defaultRoleId?: string;
  }): Promise<void> {
    this.hideModal();
    
    this.modal = this.createModalStructure(config.title);
    const form = this.createForm(config);
    
    this.modal.querySelector('.modal-body')!.appendChild(form);
    this.showModalElement();
  }

  /**
   * Create modal structure
   */
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

  /**
   * Create form
   */
  // Replace the createForm method with this simpler version:
private createForm(config: any): HTMLElement {
    const form = document.createElement('form'); // Use createElement instead of createSafeElement
    form.className = 'project-form';
    
    // Role selection
    const roleGroup = this.createRoleSelection(config.defaultRoleId);
    
    // Project name - use simple HTML creation
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Project Name';
    nameLabel.className = 'form-label';
    const nameInput = document.createElement('input');
    nameInput.id = 'project-name';
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.placeholder = 'Enter project name...';
    nameInput.value = config.project?.name || '';
    nameGroup.append(nameLabel, nameInput);
    
    // Description - use simple HTML creation
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Description';
    descLabel.className = 'form-label';
    const descInput = document.createElement('textarea');
    descInput.id = 'project-description';
    descInput.className = 'form-textarea';
    descInput.placeholder = 'Enter description...';
    descInput.rows = 3;
    descInput.value = config.project?.description || '';
    descGroup.append(descLabel, descInput);
    
    // Buttons
    const buttonGroup = this.createButtons(config.project !== null);
    
    form.append(roleGroup, nameGroup, descGroup, buttonGroup);
    
    // Set up form submission the same way as bullet editor
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
    
    return form;
  }

  /**
   * Create role selection
   */
  private createRoleSelection(defaultRoleId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Role', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'project-role';
    select.className = 'form-select';
    
    // Add roles
    this.roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = `${role.title} (${role.company})`;
      option.selected = role.id === defaultRoleId;
      select.appendChild(option);
    });
    
    group.append(label, select);
    return group;
  }

  /**
   * Create name input
   */
  private createNameInput(defaultName: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Project Name', 'form-label');
    const input = document.createElement('input'); // Use createElement like bullet editor
    
    input.id = 'project-name';
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = 'Enter project name...';
    input.value = defaultName;
    input.disabled = false; // Add this line
    
    group.append(label, input);
    return group;
  }

  /**
   * Create description input
   */
  private createDescriptionInput(defaultDescription: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Description', 'form-label');
    const textarea = document.createElement('textarea'); // Use createElement
    const counter = createSafeElement('div', '', 'char-counter');
    
    textarea.id = 'project-description';
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Enter project description (optional)...';
    textarea.rows = 3;
    textarea.value = defaultDescription;
    textarea.disabled = false; // Add this line
    
    this.updateCharCounter(defaultDescription, counter);
    
    group.append(label, textarea, counter);
    return group;
  }

  /**
   * Create form buttons
   */
  private createButtons(isEdit: boolean): HTMLElement {
    const group = createSafeElement('div', '', 'modal-buttons');
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.onclick = () => this.hideModal();
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = isEdit ? 'Update' : 'Create';
    saveBtn.className = 'btn btn-primary';
    
    group.append(cancelBtn, saveBtn);
    return group;
  }

  /**
   * Show modal element and set up events
   */
  private showModalElement(): void {
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(this.modal!);
    
    // Debug: Check if inputs are accessible
    setTimeout(() => {
        // Force enable all inputs
        const allInputs = this.modal!.querySelectorAll('input, textarea');
        allInputs.forEach((input: any) => {
          input.disabled = false;
          input.readOnly = false;
        });
        
        const nameInput = this.modal!.querySelector('#project-name') as HTMLInputElement;
        nameInput?.focus();
      }, 100);
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.modal) return;
    
    const formData = this.getFormData();
    
    // Validation
    const validation = this.validateFormData(formData);
    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }
    
    try {
      if (this.currentProjectId) {
        await this.updateProject(this.currentProjectId, formData);
      } else {
        await this.createProject(formData);
      }
      
      this.hideModal();
      
      if (this.onSave) {
        this.onSave();
      }
      
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project');
    }
  }

  /**
   * Get form data
   */
  private getFormData(): any {
    if (!this.modal) return {};
    
    return {
      roleId: (this.modal.querySelector('#project-role') as HTMLSelectElement).value,
      name: (this.modal.querySelector('#project-name') as HTMLInputElement).value.trim(),
      description: (this.modal.querySelector('#project-description') as HTMLTextAreaElement).value.trim()
    };
  }

  /**
   * Validate form data
   */
  private validateFormData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.name) {
      errors.push('Please enter a project name');
    }
    
    if (data.name.length > 100) {
      errors.push('Project name is too long (maximum 100 characters)');
    }
    
    if (data.description.length > 500) {
      errors.push('Description is too long (maximum 500 characters)');
    }
    
    if (!data.roleId) {
      errors.push('Please select a role');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create new project
   */
  private async createProject(formData: any): Promise<void> {
    const project: Project = {
      id: createId('project'),
      roleId: formData.roleId,
      name: formData.name,
      description: formData.description,
      centroidVector: new ArrayBuffer(0),
      vectorDimensions: 0,
      bulletCount: 0,
      embeddingVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await create('projects', project);
  }

  /**
   * Update existing project
   */
  private async updateProject(projectId: string, formData: any): Promise<void> {
    const existingProject = await getById<Project>('projects', projectId);
    if (!existingProject) {
      throw new Error('Project not found');
    }
    
    const updatedProject: Project = {
      ...existingProject,
      roleId: formData.roleId,
      name: formData.name,
      description: formData.description,
      updatedAt: Date.now()
    };
    
    await update('projects', updatedProject);
  }

  /**
   * Update character counter
   */
  private updateCharCounter(text: string, counter: HTMLElement): void {
    const length = text.length;
    const maxLength = 500;
    
    setSafeTextContent(counter, `${length}/${maxLength} characters`);
    
    if (length > maxLength * 0.9) {
      counter.className = 'char-counter char-counter--warning';
    } else if (length > maxLength) {
      counter.className = 'char-counter char-counter--error';
    } else {
      counter.className = 'char-counter';
    }
  }

  /**
   * Hide modal
   */
  private hideModal(): void {
    this.modal?.remove();
    this.modal = null;
    this.currentProjectId = null;
    this.onSave = undefined;
    document.onkeydown = null;
  }
}

// ============================================================================
// Global Editor Instance
// ============================================================================

let globalProjectEditor: ProjectEditor | null = null;

export function getProjectEditor(): ProjectEditor {
  if (!globalProjectEditor) {
    globalProjectEditor = new ProjectEditor();
  }
  return globalProjectEditor;
}