/**
 * Bullet form HTML builder
 * Enhanced with inline role/project creation - FIXED PROJECT LOADING
 */

import { getBulletValidator } from './bullet-validator';
import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getAll, create } from '../storage/transactions';
import { createId } from '../utils/uuid';
import type { Role, Project } from '../types';

export class BulletFormBuilder {
  private roles: Role[] = [];
  private projects: Project[] = [];

  async createForm(config: any, isEdit: boolean, onSubmit: (data: any) => Promise<void>, onCancel: () => void): Promise<HTMLElement> {
    await this.loadData();
    
    const form = createSafeElement('form', '', 'bullet-form');
    
    form.append(
      this.createRoleSection(config.defaultRoleId),
      this.createProjectSection(config.defaultRoleId, config.defaultProjectId),
      this.createTextSection(config.bullet?.text || ''),
      this.createButtonSection(isEdit, onCancel)
    );
    
    this.setupEvents(form, onSubmit);
    
    // CRITICAL FIX: Trigger role change after form is fully built to initialize projects
    const roleSelect = form.querySelector('#bullet-role') as HTMLSelectElement;
    if (roleSelect && roleSelect.value && roleSelect.value !== '__new_role__') {
      // Trigger the change event to initialize projects for the selected role
      setTimeout(() => {
        const event = new Event('change', { bubbles: true });
        roleSelect.dispatchEvent(event);
      }, 0);
    }
    
    return form;
  }

  private createRoleSection(defaultRoleId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Role', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'bullet-role';
    select.className = 'form-select';
    
    // Add existing roles
    this.roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = `${role.title} (${role.company})`;
      option.selected = role.id === defaultRoleId;
      select.appendChild(option);
    });
    
    // Add "New Role..." option
    const newRoleOption = document.createElement('option');
    newRoleOption.value = '__new_role__';
    newRoleOption.textContent = 'New Role...';
    select.appendChild(newRoleOption);
    
    // Create inline role creation fields (initially hidden)
    const inlineRoleFields = this.createInlineRoleFields();
    
    group.append(label, select, inlineRoleFields);
    return group;
  }

  private createInlineRoleFields(): HTMLElement {
    const container = createSafeElement('div', '', 'inline-role-fields');
    container.style.display = 'none';
    container.style.marginTop = '0.5rem';
    container.style.padding = '0.75rem';
    container.style.backgroundColor = '#f8f9fa';
    container.style.border = '1px solid #dee2e6';
    container.style.borderRadius = '4px';
    
    const titleGroup = createSafeElement('div', '', 'inline-field-group');
    titleGroup.style.marginBottom = '0.5rem';
    const titleLabel = createSafeElement('label', 'Role Title', 'inline-label');
    titleLabel.style.fontSize = '0.875rem';
    titleLabel.style.fontWeight = '500';
    titleLabel.style.marginBottom = '0.25rem';
    titleLabel.style.display = 'block';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'new-role-title';
    titleInput.className = 'form-input';
    titleInput.style.width = '100%';
    titleInput.placeholder = 'e.g., Senior Product Manager';
    titleGroup.append(titleLabel, titleInput);
    
    const companyGroup = createSafeElement('div', '', 'inline-field-group');
    const companyLabel = createSafeElement('label', 'Company', 'inline-label');
    companyLabel.style.fontSize = '0.875rem';
    companyLabel.style.fontWeight = '500';
    companyLabel.style.marginBottom = '0.25rem';
    companyLabel.style.display = 'block';
    const companyInput = document.createElement('input');
    companyInput.type = 'text';
    companyInput.id = 'new-role-company';
    companyInput.className = 'form-input';
    companyInput.style.width = '100%';
    companyInput.placeholder = 'e.g., Amazon';
    companyGroup.append(companyLabel, companyInput);
    
    container.append(titleGroup, companyGroup);
    return container;
  }

  private createProjectSection(defaultRoleId?: string, defaultProjectId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Project', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'bullet-project';
    select.className = 'form-select';
    
    // Start with placeholder - projects will be loaded by role change event
    const placeholderOption = document.createElement('option');
    placeholderOption.textContent = 'Select a role first';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);
    
    // Create inline project creation fields (initially hidden, no styled box)
    const inlineProjectFields = this.createInlineProjectFields();
    
    group.append(label, select, inlineProjectFields);
    
    return group;
  }

  private createInlineProjectFields(): HTMLElement {
    const container = createSafeElement('div', '', 'inline-project-fields');
    container.style.display = 'none';
    container.style.marginTop = '0.5rem';
    // Remove styled background - just a simple input
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'new-project-name';
    nameInput.className = 'form-input';
    nameInput.style.width = '100%';
    nameInput.placeholder = 'Enter project name...';
    
    container.appendChild(nameInput);
    return container;
  }

  private createTextSection(defaultText: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Bullet Point Text', 'form-label');
    const textarea = document.createElement('textarea');
    const counter = createSafeElement('div', '', 'char-counter');
    
    textarea.id = 'bullet-text';
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Enter your bullet point...';
    textarea.rows = 4;
    textarea.value = defaultText;
    
    this.updateCharCounter(defaultText, counter);
    group.append(label, textarea, counter);
    
    return group;
  }

  private createButtonSection(isEdit: boolean, onCancel: () => void): HTMLElement {
    const group = createSafeElement('div', '', 'modal-buttons');
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.onclick = onCancel;
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = isEdit ? 'Update' : 'Create';
    saveBtn.className = 'btn btn-primary';
    
    group.append(cancelBtn, saveBtn);
    return group;
  }

  private setupEvents(form: HTMLElement, onSubmit: (data: any) => Promise<void>): void {
    const roleSelect = form.querySelector('#bullet-role') as HTMLSelectElement;
    const projectSelect = form.querySelector('#bullet-project') as HTMLSelectElement;
    const textarea = form.querySelector('#bullet-text') as HTMLTextAreaElement;
    const counter = form.querySelector('.char-counter') as HTMLElement;
    const inlineRoleFields = form.querySelector('.inline-role-fields') as HTMLElement;
    const inlineProjectFields = form.querySelector('.inline-project-fields') as HTMLElement;
    
    // Role change updates projects and shows/hides inline fields
    roleSelect.addEventListener('change', () => {
      if (roleSelect.value === '__new_role__') {
        inlineRoleFields.style.display = 'block';
        // Clear and disable project selection when creating new role
        this.updateProjectOptions(projectSelect, undefined);
        // Hide project inline fields when role is being created
        inlineProjectFields.style.display = 'none';
      } else {
        inlineRoleFields.style.display = 'none';
        this.updateProjectOptions(projectSelect, roleSelect.value);
        // Check if new project was auto-selected and show field if so
        if (projectSelect.value === '__new_project__') {
          inlineProjectFields.style.display = 'block';
        } else {
          inlineProjectFields.style.display = 'none';
        }
      }
    });
    
    // Project change shows/hides inline fields
    projectSelect.addEventListener('change', () => {
      if (projectSelect.value === '__new_project__') {
        inlineProjectFields.style.display = 'block';
      } else {
        inlineProjectFields.style.display = 'none';
      }
    });
    
    // Text change updates counter
    textarea.addEventListener('input', () => {
      this.updateCharCounter(textarea.value, counter);
    });
    
    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = await this.getFormDataWithCreation(form);
      const validation = this.validateFormData(data);
      
      if (!validation.isValid) {
        alert(validation.errors.join('\n'));
        return;
      }
      
      await onSubmit(data);
    });
  }

  private updateProjectOptions(select: HTMLSelectElement, roleId?: string, selectedId?: string): void {
    select.innerHTML = '';
    
    if (!roleId || roleId === '__new_role__') {
      const option = document.createElement('option');
      option.textContent = roleId === '__new_role__' ? 'Create role first' : 'Select a role first';
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
      return;
    }
    
    // Add projects for the selected role
    const roleProjects = this.projects.filter(p => p.roleId === roleId);
    roleProjects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      option.selected = project.id === selectedId;
      select.appendChild(option);
    });
    
    // Add "New Project..." option
    const newProjectOption = document.createElement('option');
    newProjectOption.value = '__new_project__';
    newProjectOption.textContent = 'New Project...';
    select.appendChild(newProjectOption);
    
    // Auto-select "New Project..." if no existing projects
    if (roleProjects.length === 0 && !selectedId) {
      newProjectOption.selected = true;
    }
  }

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

  private async getFormDataWithCreation(form: HTMLElement): Promise<any> {
    const roleSelect = form.querySelector('#bullet-role') as HTMLSelectElement;
    const projectSelect = form.querySelector('#bullet-project') as HTMLSelectElement;
    const textArea = form.querySelector('#bullet-text') as HTMLTextAreaElement;
    
    let roleId = roleSelect.value;
    let projectId = projectSelect.value;
    
    // Create new role if needed
    if (roleId === '__new_role__') {
      const titleInput = form.querySelector('#new-role-title') as HTMLInputElement;
      const companyInput = form.querySelector('#new-role-company') as HTMLInputElement;
      
      if (!titleInput.value.trim() || !companyInput.value.trim()) {
        throw new Error('Role title and company are required');
      }
      
      const newRole: Role = {
        id: createId('role'),
        title: titleInput.value.trim(),
        company: companyInput.value.trim(),
        orderIndex: this.roles.length, // Add at end
        bulletsLimit: 10, // Default limit
        startDate: new Date().toISOString().slice(0, 7), // Current month
        endDate: null // Current role
      };
      
      const createdRole = await create('roles', newRole);
      roleId = createdRole.id;
      
      // Update local cache
      this.roles.push(createdRole);
    }
    
    // Create new project if needed
    if (projectId === '__new_project__') {
      const nameInput = form.querySelector('#new-project-name') as HTMLInputElement;
      
      if (!nameInput.value.trim()) {
        throw new Error('Project name is required');
      }
      
      const newProject: Project = {
        id: createId('project'),
        roleId: roleId,
        name: nameInput.value.trim(),
        description: '',
        bulletCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const createdProject = await create('projects', newProject);
      projectId = createdProject.id;
      
      // Update local cache
      this.projects.push(createdProject);
    }
    
    return {
      roleId,
      projectId,
      text: textArea.value.trim()
    };
  }

  private validateFormData(data: any): { isValid: boolean; errors: string[] } {
    const validator = getBulletValidator();
    const errors: string[] = [];
    
    if (!data.roleId) {
      errors.push('Role is required');
    }
    
    if (!data.projectId) {
      errors.push('Project is required');
    }
    
    const textValidation = validator.validateText(data.text);
    if (!textValidation.isValid) {
      errors.push(...textValidation.errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async loadData(): Promise<void> {
    [this.roles, this.projects] = await Promise.all([
      getAll<Role>('roles'),
      getAll<Project>('projects')
    ]);
    this.roles.sort((a, b) => a.orderIndex - b.orderIndex);
  }
}