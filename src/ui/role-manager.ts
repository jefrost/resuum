/**
 * Role Manager Component
 * Handles role list, ordering, and bullet limits
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getAll, update, deleteById } from '../storage/transactions';
import { createSimpleModal } from '../utils/simple-modal';
import type { Role } from '../types';

// ============================================================================
// Role Manager Class
// ============================================================================

export class RoleManager {
  private container: HTMLElement | null = null;
  private roles: Role[] = [];
  private sortBy: 'endDate' | 'startDate' = 'endDate';

  /**
   * Render role management interface
   */
  async render(container: HTMLElement): Promise<void> {
    this.container = container;
    await this.loadRoles();
    
    container.innerHTML = '';
    
    const header = this.createHeader();
    const rolesList = this.createRolesList();
    
    container.appendChild(header);
    container.appendChild(rolesList);
  }

  /**
   * Create header with add button and sort control
   */
  private createHeader(): HTMLElement {
    const header = createSafeElement('div', '', 'role-manager-header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    `;
    
    const leftSection = createSafeElement('div', '', 'header-left');
    
    const description = createSafeElement('p',
      'Roles are automatically sorted by date (most recent first). Set bullet limits for recommendations.',
      'section-description'
    );
    
    const addBtn = document.createElement('button');
    addBtn.className = 'form-button form-button--primary';
    addBtn.style.marginTop = '0.5rem';
    setSafeTextContent(addBtn, 'Add Role');
    addBtn.addEventListener('click', () => this.showAddModal());
    
    leftSection.appendChild(description);
    leftSection.appendChild(addBtn);
    
    // Sort control
    const sortSection = createSafeElement('div', '', 'header-sort');
    const sortLabel = createSafeElement('label', 'Sort by:', 'sort-label');
    sortLabel.style.cssText = `
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    `;
    
    const sortSelect = document.createElement('select') as HTMLSelectElement;
    sortSelect.style.cssText = `
      padding: 0.375rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.875rem;
      background: white;
    `;
    
    const endDateOption = document.createElement('option');
    endDateOption.value = 'endDate';
    setSafeTextContent(endDateOption, 'End Date');
    endDateOption.selected = this.sortBy === 'endDate';
    
    const startDateOption = document.createElement('option');
    startDateOption.value = 'startDate';
    setSafeTextContent(startDateOption, 'Start Date');
    startDateOption.selected = this.sortBy === 'startDate';
    
    sortSelect.appendChild(endDateOption);
    sortSelect.appendChild(startDateOption);
    
    sortSelect.addEventListener('change', () => {
      this.sortBy = sortSelect.value as 'endDate' | 'startDate';
      this.render(this.container!);
    });
    
    sortSection.appendChild(sortLabel);
    sortSection.appendChild(sortSelect);
    
    header.appendChild(leftSection);
    header.appendChild(sortSection);
    
    return header;
  }

  /**
   * Create roles list
   */
  private createRolesList(): HTMLElement {
    const container = createSafeElement('div', '', 'roles-list');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.75rem;
    `;
    
    if (this.roles.length === 0) {
      const empty = createSafeElement('div', 'No roles configured. Add your first role to get started.', 'empty-state');
      empty.style.cssText = `
        padding: 2rem;
        text-align: center;
        color: #6b7280;
        border: 2px dashed #d1d5db;
        border-radius: 8px;
      `;
      container.appendChild(empty);
      return container;
    }
    
    // Sort roles by selected criteria
    const sortedRoles = this.getSortedRoles();
    
    sortedRoles.forEach(role => {
      const item = this.createRoleCard(role);
      container.appendChild(item);
    });
    
    return container;
  }

  /**
   * Get roles sorted by current criteria
   */
  private getSortedRoles(): Role[] {
    return [...this.roles].sort((a, b) => {
      if (this.sortBy === 'endDate') {
        // Sort by end date, most recent first (null end dates = current roles go first)
        const aDate = a.endDate || '9999-99'; // Current roles sort to top
        const bDate = b.endDate || '9999-99';
        return bDate.localeCompare(aDate);
      } else {
        // Sort by start date, most recent first
        return b.startDate.localeCompare(a.startDate);
      }
    });
  }

  /**
   * Create compact role card
   */
  private createRoleCard(role: Role): HTMLElement {
    const card = createSafeElement('div', '', 'role-card');
    card.style.cssText = `
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: box-shadow 0.15s ease;
    `;
    
    // Top line: Name and Date
    const topLine = createSafeElement('div', '', 'role-top-line');
    topLine.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    `;
    
    const nameSection = createSafeElement('div', '', 'role-name');
    const title = createSafeElement('div', `${role.title} at ${role.company}`, 'role-title');
    title.style.cssText = `
      font-weight: 600;
      font-size: 0.95rem;
      color: #111827;
    `;
    nameSection.appendChild(title);
    
    const dateSection = createSafeElement('div', '', 'role-date');
    const dates = createSafeElement('div', this.formatDateRange(role), 'role-dates');
    dates.style.cssText = `
      color: #6b7280;
      font-size: 0.8rem;
      text-align: right;
    `;
    dateSection.appendChild(dates);
    
    topLine.appendChild(nameSection);
    topLine.appendChild(dateSection);
    
    // Bottom line: Bullets and Actions
    const bottomLine = createSafeElement('div', '', 'role-bottom-line');
    bottomLine.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    // Bullets section
    const bulletsSection = createSafeElement('div', '', 'role-bullets');
    bulletsSection.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;
    
    const bulletsLabel = createSafeElement('span', 'Bullets:', 'bullets-label');
    bulletsLabel.style.cssText = `
      font-size: 0.8rem;
      color: #374151;
      font-weight: 500;
    `;
    
    const limitInput = document.createElement('input') as HTMLInputElement;
    limitInput.type = 'number';
    limitInput.min = '1';
    limitInput.max = '10';
    limitInput.value = role.bulletsLimit.toString();
    limitInput.style.cssText = `
      width: 50px;
      padding: 0.2rem 0.4rem;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      text-align: center;
      font-size: 0.8rem;
    `;
    limitInput.addEventListener('change', () => this.updateLimit(role.id, parseInt(limitInput.value)));
    
    bulletsSection.appendChild(bulletsLabel);
    bulletsSection.appendChild(limitInput);
    
    // Actions section
    const actionsSection = createSafeElement('div', '', 'role-actions');
    actionsSection.style.cssText = `
      display: flex;
      gap: 0.4rem;
    `;
    
    const editBtn = this.createActionButton('Edit', 'secondary', () => this.showEditModal(role.id));
    const deleteBtn = this.createActionButton('Delete', 'danger', () => this.deleteRole(role.id));
    
    actionsSection.appendChild(editBtn);
    actionsSection.appendChild(deleteBtn);
    
    bottomLine.appendChild(bulletsSection);
    bottomLine.appendChild(actionsSection);
    
    // Assemble card
    card.appendChild(topLine);
    card.appendChild(bottomLine);
    
    // Add hover effect
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    });
    
    return card;
  }

  /**
   * Create compact action button
   */
  private createActionButton(text: string, variant: 'secondary' | 'danger', onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    setSafeTextContent(button, text);
    button.addEventListener('click', onClick);
    
    const baseStyles = `
      padding: 0.3rem 0.6rem;
      border-radius: 3px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    `;
    
    if (variant === 'danger') {
      button.style.cssText = baseStyles + `
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      `;
    } else {
      button.style.cssText = baseStyles + `
        background: #f9fafb;
        color: #374151;
        border: 1px solid #d1d5db;
      `;
    }
    
    return button;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Update bullet limit
   */
  private async updateLimit(roleId: string, limit: number): Promise<void> {
    if (limit < 1 || limit > 10 || isNaN(limit)) {
      alert('Bullet limit must be between 1 and 10');
      if (this.container) await this.render(this.container);
      return;
    }
    
    try {
      const role = this.roles.find(r => r.id === roleId);
      if (!role) return;
      
      role.bulletsLimit = limit;
      await update('roles', role);
      
    } catch (error) {
      alert(`Failed to update limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete role
   */
  private async deleteRole(roleId: string): Promise<void> {
    const role = this.roles.find(r => r.id === roleId);
    if (!role) return;
    
    if (!confirm(`Delete "${role.title} at ${role.company}"? This will also delete associated data.`)) {
      return;
    }
    
    try {
      await deleteById('roles', roleId);
      if (this.container) await this.render(this.container);
      
    } catch (error) {
      alert(`Failed to delete role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Show add modal
   */
  private showAddModal(): void {
    createSimpleModal('Add Role', this.createRoleForm(), (formData) => {
      this.saveRole(formData);
    });
  }

  /**
   * Show edit modal
   */
  private showEditModal(roleId: string): void {
    const role = this.roles.find(r => r.id === roleId);
    if (!role) return;
    
    createSimpleModal('Edit Role', this.createRoleForm(role), (formData) => {
      this.saveRole(formData, role.id);
    });
  }

  /**
   * Create role form with simple date inputs
   */
  private createRoleForm(role?: Role): HTMLElement {
    const form = createSafeElement('div', '', 'role-form');
    
    // Title input
    const titleGroup = this.createInputGroup('title', 'Job Title', 'text', 'e.g., Senior Product Manager');
    if (role) (titleGroup.querySelector('input') as HTMLInputElement).value = role.title;
    
    // Company input
    const companyGroup = this.createInputGroup('company', 'Company', 'text', 'e.g., Google');
    if (role) (companyGroup.querySelector('input') as HTMLInputElement).value = role.company;
    
    // Start date input
    const startGroup = this.createDateInputGroup('startDate', 'Start Date', 'e.g., 2023-01');
    if (role) (startGroup.querySelector('input') as HTMLInputElement).value = role.startDate;
    
    // End date input
    const endGroup = this.createDateInputGroup('endDate', 'End Date', 'e.g., 2024-12');
    if (role && role.endDate) (endGroup.querySelector('input') as HTMLInputElement).value = role.endDate;
    
    // Current role checkbox
    const currentGroup = createSafeElement('div', '', 'input-group');
    const currentLabel = createSafeElement('label', '', 'checkbox-label');
    
    const currentCheckbox = document.createElement('input') as HTMLInputElement;
    currentCheckbox.type = 'checkbox';
    currentCheckbox.name = 'isCurrent';
    currentCheckbox.checked = role ? !role.endDate : false;
    
    const checkboxText = createSafeElement('span', 'This is my current role', '');
    
    currentLabel.appendChild(currentCheckbox);
    currentLabel.appendChild(checkboxText);
    currentGroup.appendChild(currentLabel);
    
    // Handle current role checkbox
    const endInput = endGroup.querySelector('input') as HTMLInputElement;
    
    const updateEndDateState = () => {
      endInput.disabled = currentCheckbox.checked;
      if (currentCheckbox.checked) {
        endInput.value = '';
      }
    };
    
    currentCheckbox.addEventListener('change', updateEndDateState);
    updateEndDateState();
    
    form.appendChild(titleGroup);
    form.appendChild(companyGroup);
    form.appendChild(startGroup);
    form.appendChild(endGroup);
    form.appendChild(currentGroup);
    
    return form;
  }

  /**
   * Create input group helper
   */
  private createInputGroup(name: string, label: string, type: string, placeholder: string): HTMLElement {
    const group = createSafeElement('div', '', 'input-group');
    
    const labelElement = createSafeElement('label', label, 'input-label');
    const input = document.createElement('input') as HTMLInputElement;
    input.type = type;
    input.name = name;
    input.className = 'form-input';
    input.placeholder = placeholder;
    
    if (name === 'title' || name === 'company') {
      input.required = true;
    }
    
    group.appendChild(labelElement);
    group.appendChild(input);
    
    return group;
  }

  /**
   * Create date input group with validation
   */
  private createDateInputGroup(name: string, label: string, placeholder: string): HTMLElement {
    const group = createSafeElement('div', '', 'input-group');
    
    const labelElement = createSafeElement('label', label, 'input-label');
    
    const input = document.createElement('input') as HTMLInputElement;
    input.type = 'text';
    input.name = name;
    input.className = 'form-input';
    input.placeholder = placeholder;
    input.pattern = '^\\d{4}-\\d{2}$';
    input.title = 'Format: YYYY-MM (e.g., 2023-01)';
    
    const helper = createSafeElement('small', 'Format: YYYY-MM', 'input-helper');
    
    if (name === 'startDate') {
      input.required = true;
    }
    
    group.appendChild(labelElement);
    group.appendChild(input);
    group.appendChild(helper);
    
    return group;
  }

  /**
   * Save role
   */
  private async saveRole(formData: FormData, roleId?: string): Promise<void> {
    const title = formData.get('title') as string;
    const company = formData.get('company') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const isCurrent = formData.get('isCurrent') === 'true';
    
    if (!title || !company || !startDate) {
      alert('Title, company, and start date are required');
      return;
    }
    
    // Validate date format
    const datePattern = /^\d{4}-\d{2}$/;
    if (!datePattern.test(startDate)) {
      alert('Start date must be in YYYY-MM format (e.g., 2023-01)');
      return;
    }
    
    if (endDate && !isCurrent && !datePattern.test(endDate)) {
      alert('End date must be in YYYY-MM format (e.g., 2024-12)');
      return;
    }
    
    try {
      if (roleId) {
        // Update existing
        const role = this.roles.find(r => r.id === roleId);
        if (role) {
          role.title = title;
          role.company = company;
          role.startDate = startDate;
          role.endDate = isCurrent ? null : (endDate || null);
          await update('roles', role);
        }
      } else {
        // Create new role - no need to set orderIndex since we sort by date
        const newRole: Role = {
          id: `role_${Date.now()}`,
          title,
          company,
          orderIndex: 0, // Not used anymore but keeping for compatibility
          bulletsLimit: 3,
          startDate,
          endDate: isCurrent ? null : (endDate || null)
        };
        
        await update('roles', newRole);
      }
      
      if (this.container) await this.render(this.container);
      
    } catch (error) {
      alert(`Failed to save role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Load roles from storage
   */
  private async loadRoles(): Promise<void> {
    this.roles = await getAll<Role>('roles');
  }

  /**
   * Format date range
   */
  private formatDateRange(role: Role): string {
    return role.endDate ? `${role.startDate} - ${role.endDate}` : `${role.startDate} - Present`;
  }
}