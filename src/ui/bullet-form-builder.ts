/**
 * Bullet form HTML builder
 * Simplified for AI-analysis approach
 */

import { getBulletValidator } from './bullet-validator';
import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getAll } from '../storage/transactions';
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
    
    return form;
  }

  private createRoleSection(defaultRoleId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Role', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'bullet-role';
    select.className = 'form-select';
    
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

  private createProjectSection(defaultRoleId?: string, defaultProjectId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Project', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'bullet-project';
    select.className = 'form-select';
    
    this.updateProjectOptions(select, defaultRoleId, defaultProjectId);
    
    group.append(label, select);
    return group;
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
    
    // Role change updates projects
    roleSelect.addEventListener('change', () => {
      this.updateProjectOptions(projectSelect, roleSelect.value);
    });
    
    // Text change updates counter
    textarea.addEventListener('input', () => {
      this.updateCharCounter(textarea.value, counter);
    });
    
    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = this.getFormData(form);
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
    
    if (!roleId) {
      const option = document.createElement('option');
      option.textContent = 'Select a role first';
      option.disabled = true;
      select.appendChild(option);
      return;
    }
    
    // Add projects for the selected role
    this.projects.filter(p => p.roleId === roleId).forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      option.selected = project.id === selectedId;
      select.appendChild(option);
    });
    
    if (this.projects.filter(p => p.roleId === roleId).length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No projects available';
      option.disabled = true;
      select.appendChild(option);
    }
  }

  /**
   * Update character counter (implemented locally)
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

  private getFormData(form: HTMLElement): any {
    return {
      roleId: (form.querySelector('#bullet-role') as HTMLSelectElement).value,
      projectId: (form.querySelector('#bullet-project') as HTMLSelectElement).value,
      text: (form.querySelector('#bullet-text') as HTMLTextAreaElement).value.trim()
    };
  }

  private validateFormData(data: any): { isValid: boolean; errors: string[] } {
    const validator = getBulletValidator();
    return validator.validateBullet(data);
  }

  private async loadData(): Promise<void> {
    [this.roles, this.projects] = await Promise.all([
      getAll<Role>('roles'),
      getAll<Project>('projects')
    ]);
    this.roles.sort((a, b) => a.orderIndex - b.orderIndex);
  }
}