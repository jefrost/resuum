/**
 * Bullet form HTML builder (120 lines)
 */

import { BulletValidator } from './bullet-validator';
import { createSafeElement } from './xss-safe-rendering';
import { getAll } from '../storage/transactions';
import type { Role, Project } from '../types';

export class BulletFormBuilder {
  private validator = new BulletValidator();
  private roles: Role[] = [];
  private projects: Project[] = [];

  async createForm(config: any, isEdit: boolean, onSubmit: (data: any) => Promise<void>, onCancel: () => void): Promise<HTMLElement> {
    await this.loadData();
    
    const form = createSafeElement('form', '', 'bullet-form');
    
    form.append(
      this.createRoleSection(config.defaultRoleId),
      this.createProjectSection(config.defaultRoleId, config.defaultProjectId),
      this.createTextSection(config.bullet?.text || ''),
      this.createQualitySection(),
      this.createButtonSection(isEdit, onCancel)
    );
    
    this.setupEvents(form, onSubmit);
    this.updateQualityPreview(form, config.bullet?.text || '');
    
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
    
    const newOption = document.createElement('option');
    newOption.value = 'new_role';
    newOption.textContent = '+ New Role';
    select.appendChild(newOption);
    
    const newInputs = this.createNewRoleInputs();
    group.append(label, select, newInputs);
    
    return group;
  }

  private createProjectSection(defaultRoleId?: string, defaultProjectId?: string): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Project', 'form-label');
    const select = document.createElement('select');
    
    select.id = 'bullet-project';
    select.className = 'form-select';
    
    this.updateProjectOptions(select, defaultRoleId, defaultProjectId);
    
    const newInputs = this.createNewProjectInputs();
    group.append(label, select, newInputs);
    
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
    textarea.disabled = false;
    
    this.validator.updateCharCounter(defaultText, counter);
    group.append(label, textarea, counter);

    textarea.addEventListener('input', (e) => {
        console.log('Text input working:', textarea.value.length);
      });
    
    return group;
  }

  private createQualitySection(): HTMLElement {
    const group = createSafeElement('div', '', 'form-group');
    const label = createSafeElement('label', 'Quality Indicators', 'form-label');
    const preview = createSafeElement('div', '', 'quality-preview');
    
    group.append(label, preview);
    return group;
  }

  private createButtonSection(isEdit: boolean, onCancel: () => void): HTMLElement {
    const group = createSafeElement('div', '', 'modal-buttons');
    const cancelBtn = document.createElement('button');
    const saveBtn = document.createElement('button');
    
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.onclick = onCancel;
    
    saveBtn.type = 'submit';
    saveBtn.textContent = isEdit ? 'Update' : 'Create';
    saveBtn.className = 'btn btn-primary';
    
    group.append(cancelBtn, saveBtn);
    return group;
  }

  private createNewRoleInputs(): HTMLElement {
    const container = createSafeElement('div', '', 'new-role-input hidden');
    const titleInput = document.createElement('input');
    const companyInput = document.createElement('input');
    
    titleInput.id = 'new-role-title';
    titleInput.placeholder = 'Role title';
    titleInput.className = 'form-input';
    
    companyInput.id = 'new-role-company';
    companyInput.placeholder = 'Company name';
    companyInput.className = 'form-input';
    
    container.append(titleInput, companyInput);

    titleInput.addEventListener('input', (e) => {
        console.log('Role title input working');
      });

    return container;
  }

  private createNewProjectInputs(): HTMLElement {
    const container = createSafeElement('div', '', 'new-project-input hidden');
    const nameInput = document.createElement('input');
    const descInput = document.createElement('textarea');
    
    nameInput.id = 'new-project-name';
    nameInput.placeholder = 'Project name';
    nameInput.className = 'form-input';
    
    descInput.id = 'new-project-description';
    descInput.placeholder = 'Description (optional)';
    descInput.className = 'form-textarea';
    descInput.rows = 2;
    
    container.append(nameInput, descInput);
    return container;
  }

  private setupEvents(form: HTMLElement, onSubmit: (data: any) => Promise<void>): void {
    const roleSelect = form.querySelector('#bullet-role') as HTMLSelectElement;
    const projectSelect = form.querySelector('#bullet-project') as HTMLSelectElement;
    const textInput = form.querySelector('#bullet-text') as HTMLTextAreaElement;
    const newRoleInputs = form.querySelector('.new-role-input') as HTMLElement;
    const newProjectInputs = form.querySelector('.new-project-input') as HTMLElement;
  
    // CRITICAL FIX: Check initial state and show inputs if needed
    if (roleSelect.value === 'new_role') {
      newRoleInputs.classList.remove('hidden');
    }
    
    if (projectSelect.value === 'new_project') {
      newProjectInputs.classList.remove('hidden');
    }
  
    // Fix role change handler (remove unused parameter)
    roleSelect.addEventListener('change', () => {
      console.log('Role changed to:', roleSelect.value);
      
      if (roleSelect.value === 'new_role') {
        newRoleInputs.classList.remove('hidden');
        this.updateProjectOptions(projectSelect, undefined);
      } else {
        newRoleInputs.classList.add('hidden');
        this.updateProjectOptions(projectSelect, roleSelect.value);
      }
    });
  
    // Test if text input works
    textInput.addEventListener('input', () => {
      console.log('Text input working, length:', textInput.value.length);
      const counter = form.querySelector('.char-counter') as HTMLElement;
      this.validator.updateCharCounter(textInput.value, counter);
      this.updateQualityPreview(form, textInput.value);
    });
    
    roleSelect.onchange = () => {
      const newRoleInputs = form.querySelector('.new-role-input') as HTMLElement;
      if (roleSelect.value === 'new_role') {
        newRoleInputs.classList.remove('hidden');
      } else {
        newRoleInputs.classList.add('hidden');
        this.updateProjectOptions(projectSelect, roleSelect.value);
      }
    };
    
    projectSelect.onchange = () => {
      const newProjectInputs = form.querySelector('.new-project-input') as HTMLElement;
      newProjectInputs.classList.toggle('hidden', projectSelect.value !== 'new_project');
    };
    
    textInput.oninput = () => {
      const counter = form.querySelector('.char-counter') as HTMLElement;
      this.validator.updateCharCounter(textInput.value, counter);
      this.updateQualityPreview(form, textInput.value);
    };
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = this.getFormData(form);
      const validation = this.validator.validate(data);
      if (!validation.isValid) {
        alert(validation.errors.join('\n'));
        return;
      }
      await onSubmit(data);
    };

    // In setupEvents method, replace the role change handler:
    roleSelect.addEventListener('change', (e) => {
        console.log('Role changed to:', roleSelect.value);
        const selectedRole = roleSelect.value;
        
        if (selectedRole === 'new_role') {
        newRoleInputs.classList.remove('hidden');
        this.updateProjectOptions(projectSelect, undefined);
        } else {
        newRoleInputs.classList.add('hidden');
        this.updateProjectOptions(projectSelect, selectedRole);
        }
    });
  }

  private updateProjectOptions(select: HTMLSelectElement, roleId?: string, selectedId?: string): void {
    select.innerHTML = '';
    
    if (!roleId || roleId === 'new_role') {
      const option = document.createElement('option');
      option.textContent = 'Select a role first';
      option.disabled = true;
      select.appendChild(option);
      return;
    }
    
    const noProjectOption = document.createElement('option');
    noProjectOption.value = `no_project_${roleId}`;
    noProjectOption.textContent = 'No Project';
    noProjectOption.selected = selectedId === `no_project_${roleId}`;
    select.appendChild(noProjectOption);
    
    this.projects.filter(p => p.roleId === roleId).forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      option.selected = project.id === selectedId;
      select.appendChild(option);
    });
    
    const newOption = document.createElement('option');
    newOption.value = 'new_project';
    newOption.textContent = '+ New Project';
    select.appendChild(newOption);
  }

  private updateQualityPreview(form: HTMLElement, text: string): void {
    const preview = form.querySelector('.quality-preview') as HTMLElement;
    const features = this.validator.analyzeFeatures(text);
    
    preview.innerHTML = '';
    [
      { key: 'hasNumbers', label: 'Contains Numbers', active: features.hasNumbers },
      { key: 'actionVerb', label: 'Strong Action Verb', active: features.actionVerb },
      { key: 'lengthOk', label: 'Good Length', active: features.lengthOk }
    ].forEach(indicator => {
      const badge = createSafeElement('span', indicator.label, 
        `quality-indicator ${indicator.active ? 'quality-indicator--active' : 'quality-indicator--inactive'}`);
      preview.appendChild(badge);
    });
  }

  private getFormData(form: HTMLElement): any {
    return {
      roleId: (form.querySelector('#bullet-role') as HTMLSelectElement).value,
      projectId: (form.querySelector('#bullet-project') as HTMLSelectElement).value,
      text: (form.querySelector('#bullet-text') as HTMLTextAreaElement).value.trim(),
      newRoleTitle: (form.querySelector('#new-role-title') as HTMLInputElement)?.value.trim(),
      newRoleCompany: (form.querySelector('#new-role-company') as HTMLInputElement)?.value.trim(),
      newProjectName: (form.querySelector('#new-project-name') as HTMLInputElement)?.value.trim(),
      newProjectDescription: (form.querySelector('#new-project-description') as HTMLTextAreaElement)?.value.trim()
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