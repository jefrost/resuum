/**
 * Project Form Builder
 * Handles project form creation with bullet editing
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getAll, create } from '../storage/transactions';
import { createId } from '../utils/uuid';
import type { Role, Project, Bullet } from '../types';

export class ProjectFormBuilder {
  private roles: Role[] = [];

  async createForm(
    config: {
      project: Project | null;
      defaultRoleId?: string;
      bullets: Bullet[];
      isEdit: boolean;
    },
    onSubmit: (data: any) => Promise<void>,
    onCancel: () => void
  ): Promise<HTMLElement> {
    await this.loadRoles();
    
    const form = createSafeElement('form', '', 'project-form');
    
    form.append(
      this.createRoleSection(config.defaultRoleId),
      this.createNameSection(config.project?.name || ''),
      this.createDescriptionSection(config.project?.description || ''),
      this.createBulletPointsSection(config.bullets, config.isEdit),
      this.createButtonSection(config.isEdit, onCancel)
    );
    
    this.setupEvents(form, onSubmit);
    
    return form;
  }

  private createRoleSection(defaultRoleId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Role', 'form-label');
    
    const select = document.createElement('select');
    select.id = 'project-role';
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
    
    // Create inline role creation fields
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

  private createNameSection(defaultName: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Project Name', 'form-label');
    const input = document.createElement('input');
    input.id = 'project-name';
    input.type = 'text';
    input.className = 'form-input';
    input.placeholder = 'Enter project name...';
    input.value = defaultName;
    
    group.append(label, input);
    return group;
  }

  private createDescriptionSection(defaultDescription: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Description', 'form-label');
    const textarea = document.createElement('textarea');
    textarea.id = 'project-description';
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Enter description...';
    textarea.rows = 3;
    textarea.value = defaultDescription;
    
    group.append(label, textarea);
    return group;
  }

  private createBulletPointsSection(bullets: Bullet[], isEdit: boolean): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    
    // Always show this section when editing, or if bullets exist
    if (!isEdit && bullets.length === 0) {
      group.style.display = 'none';
      return group;
    }
    
    const label = createSafeElement('label', 'Bullet Points', 'form-label');
    
    const helpText = createSafeElement('div', 
      'Enter one bullet point per line. Add new lines to create additional bullet points.',
      ''
    );
    helpText.style.fontSize = '0.875rem';
    helpText.style.color = '#6c757d';
    helpText.style.marginBottom = '0.5rem';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'project-bullets';
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Enter bullet points, one per line...';
    textarea.rows = Math.max(6, bullets.length + 2);
    
    // Pre-populate with existing bullets
    const bulletTexts = bullets.map(bullet => bullet.text);
    textarea.value = bulletTexts.join('\n');
    
    // Bullet counter
    const counter = createSafeElement('div', '', 'char-counter');
    const updateCounter = () => {
      const lines = textarea.value.split('\n').filter(line => line.trim().length > 0);
      setSafeTextContent(counter, `${lines.length} bullet points, ${textarea.value.length} characters`);
    };
    updateCounter();
    
    textarea.addEventListener('input', updateCounter);
    
    group.append(label, helpText, textarea, counter);
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
    const roleSelect = form.querySelector('#project-role') as HTMLSelectElement;
    const inlineRoleFields = form.querySelector('.inline-role-fields') as HTMLElement;
    
    // Role change shows/hides inline fields
    roleSelect.addEventListener('change', () => {
      if (roleSelect.value === '__new_role__') {
        inlineRoleFields.style.display = 'block';
      } else {
        inlineRoleFields.style.display = 'none';
      }
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

  private async getFormDataWithCreation(form: HTMLElement): Promise<any> {
    const roleSelect = form.querySelector('#project-role') as HTMLSelectElement;
    const nameInput = form.querySelector('#project-name') as HTMLInputElement;
    const descInput = form.querySelector('#project-description') as HTMLTextAreaElement;
    const bulletsTextarea = form.querySelector('#project-bullets') as HTMLTextAreaElement;
    
    let roleId = roleSelect.value;
    
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
        orderIndex: this.roles.length,
        bulletsLimit: 10,
        startDate: new Date().toISOString().slice(0, 7),
        endDate: null
      };
      
      const createdRole = await create('roles', newRole);
      roleId = createdRole.id;
      this.roles.push(createdRole);
    }
    
    // Parse bullet points from textarea
    const bulletTexts = bulletsTextarea ? 
      bulletsTextarea.value.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0) 
      : [];
    
    return {
      roleId,
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      bulletTexts
    };
  }

  private validateFormData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.name) {
      errors.push('Project name is required');
    }
    
    if (!data.roleId) {
      errors.push('Role is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async loadRoles(): Promise<void> {
    this.roles = await getAll<Role>('roles');
    this.roles.sort((a, b) => a.orderIndex - b.orderIndex);
  }
}