/**
 * Bullets Table Component
 * Simplified for AI-analysis approach
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getBulletDataService } from './bullet-data-service';
import type { Bullet, Role, Project } from '../types';

// ============================================================================
// Bullets Table Class
// ============================================================================

export class BulletsTable {
  private container: HTMLElement;
  private bullets: Array<{
    bullet: Bullet;
    role: Role | null;
    project: Project | null;
  }> = [];
  private filterText: string = '';
  private sortBy: 'role' | 'project' | 'text' | 'modified' = 'modified';
  private sortOrder: 'asc' | 'desc' = 'desc';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render the bullets table
   */
  async render(): Promise<void> {
    await this.loadData();
    
    this.container.innerHTML = '';
    
    const header = this.createTableHeader();
    const table = this.createTable();
    
    this.container.appendChild(header);
    this.container.appendChild(table);
  }

  /**
   * Create table header with controls
   */
  private createTableHeader(): HTMLElement {
    const header = createSafeElement('div', '', 'bullets-table-header');
    
    // Add bullet button
    const addButton = createSafeElement('button', 'Add Bullet Point', 'btn btn-primary');
    addButton.addEventListener('click', () => this.showAddModal());
    
    // Filter input
    const filterInput = document.createElement('input') as HTMLInputElement;
    filterInput.type = 'text';
    filterInput.placeholder = 'Filter bullet points...';
    filterInput.className = 'filter-input';
    filterInput.value = this.filterText;
    filterInput.addEventListener('input', (e) => {
      this.filterText = (e.target as HTMLInputElement).value;
      this.render();
    });
    
    // Sort controls
    const sortGroup = createSafeElement('div', '', 'sort-controls');
    
    const sortSelect = document.createElement('select') as HTMLSelectElement;
    sortSelect.className = 'sort-select';
    
    const sortOptions = [
      { value: 'modified', label: 'Last Modified' },
      { value: 'role', label: 'Role' },
      { value: 'project', label: 'Project' },
      { value: 'text', label: 'Text' }
    ];
    
    sortOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.selected = this.sortBy === option.value;
      setSafeTextContent(optionElement, option.label);
      sortSelect.appendChild(optionElement);
    });
    
    sortSelect.addEventListener('change', () => {
      this.sortBy = sortSelect.value as any;
      this.render();
    });
    
    const orderButton = createSafeElement('button', 
      this.sortOrder === 'asc' ? '↑' : '↓', 
      'btn btn-sm sort-order-btn'
    );
    orderButton.addEventListener('click', () => {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      this.render();
    });
    
    sortGroup.appendChild(sortSelect);
    sortGroup.appendChild(orderButton);
    
    header.appendChild(addButton);
    header.appendChild(filterInput);
    header.appendChild(sortGroup);
    
    return header;
  }

  /**
   * Create the main table
   */
  private createTable(): HTMLElement {
    const table = createSafeElement('table', '', 'bullets-table');
    
    // Table header
    const thead = createSafeElement('thead');
    const headerRow = createSafeElement('tr');
    
    ['Role', 'Project', 'Bullet Text', 'Modified', 'Actions'].forEach(text => {
      const th = createSafeElement('th', text, 'table-header-cell');
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = createSafeElement('tbody');
    const filteredBullets = this.getFilteredAndSortedBullets();
    
    if (filteredBullets.length === 0) {
      const emptyRow = this.createEmptyRow();
      tbody.appendChild(emptyRow);
    } else {
      filteredBullets.forEach(bulletData => {
        const row = this.createBulletRow(bulletData);
        tbody.appendChild(row);
      });
    }
    
    table.appendChild(tbody);
    return table;
  }

  /**
   * Create empty state row
   */
  private createEmptyRow(): HTMLElement {
    const row = createSafeElement('tr', '', 'empty-row');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty-cell';
    setSafeTextContent(cell, 
      this.filterText 
        ? 'No bullet points match your filter' 
        : 'No bullet points found. Add your first bullet point to get started.'
    );
    row.appendChild(cell);
    return row;
  }

  /**
   * Create bullet row
   */
  private createBulletRow(bulletData: {
    bullet: Bullet;
    role: Role | null;
    project: Project | null;
  }): HTMLElement {
    const { bullet, role, project } = bulletData;
    const row = createSafeElement('tr', '', 'bullet-row');
    
    // Role cell
    const roleCell = createSafeElement('td', '', 'role-cell');
    setSafeTextContent(roleCell, 
      role ? `${role.title} at ${role.company}` : 'Unknown Role'
    );
    
    // Project cell
    const projectCell = createSafeElement('td', '', 'project-cell');
    setSafeTextContent(projectCell, 
      project ? project.name : 'No Project'
    );
    
    // Text cell (truncated for table display)
    const textCell = createSafeElement('td', '', 'text-cell');
    const truncatedText = bullet.text.length > 80 
      ? bullet.text.substring(0, 80) + '...'
      : bullet.text;
    setSafeTextContent(textCell, truncatedText);
    textCell.title = bullet.text; // Full text on hover
    
    // Modified date cell
    const modifiedCell = createSafeElement('td', '', 'modified-cell');
    setSafeTextContent(modifiedCell, 
      new Date(bullet.lastModified).toLocaleDateString()
    );
    
    // Actions cell
    const actionsCell = createSafeElement('td', '', 'actions-cell');
    
    const editButton = createSafeElement('button', 'Edit', 'btn btn-sm btn-secondary');
    editButton.addEventListener('click', () => this.editBullet(bullet.id));
    
    const deleteButton = createSafeElement('button', 'Delete', 'btn btn-sm btn-danger');
    deleteButton.addEventListener('click', () => this.deleteBullet(bullet.id));
    
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);
    
    // Assemble row
    row.appendChild(roleCell);
    row.appendChild(projectCell);
    row.appendChild(textCell);
    row.appendChild(modifiedCell);
    row.appendChild(actionsCell);
    
    return row;
  }

  /**
   * Get filtered and sorted bullets
   */
  private getFilteredAndSortedBullets(): Array<{
    bullet: Bullet;
    role: Role | null;
    project: Project | null;
  }> {
    let filtered = this.bullets;
    
    // Apply text filter
    if (this.filterText) {
      const filterLower = this.filterText.toLowerCase();
      filtered = filtered.filter(bulletData => {
        const { bullet, role, project } = bulletData;
        return (
          bullet.text.toLowerCase().includes(filterLower) ||
          role?.title.toLowerCase().includes(filterLower) ||
          role?.company.toLowerCase().includes(filterLower) ||
          project?.name.toLowerCase().includes(filterLower)
        );
      });
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'role':
          const roleA = a.role?.title || '';
          const roleB = b.role?.title || '';
          comparison = roleA.localeCompare(roleB);
          break;
        case 'project':
          const projectA = a.project?.name || '';
          const projectB = b.project?.name || '';
          comparison = projectA.localeCompare(projectB);
          break;
        case 'text':
          comparison = a.bullet.text.localeCompare(b.bullet.text);
          break;
        case 'modified':
          comparison = a.bullet.lastModified - b.bullet.lastModified;
          break;
      }
      
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Load bullet data with context
   */
  private async loadData(): Promise<void> {
    try {
      const bulletService = getBulletDataService();
      this.bullets = await bulletService.getBulletsWithContext();
    } catch (error) {
      console.error('Failed to load bullet data:', error);
      this.bullets = [];
    }
  }

  /**
   * Show add bullet modal
   */
  private showAddModal(): void {
    // TODO: Implement add bullet modal
    console.log('Add bullet modal not implemented yet');
  }

  /**
   * Edit bullet
   */
  private editBullet(bulletId: string): void {
    // TODO: Implement edit bullet modal
    console.log('Edit bullet not implemented yet:', bulletId);
  }

  /**
   * Delete bullet
   */
  private async deleteBullet(bulletId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this bullet point?')) {
      return;
    }
    
    try {
      const bulletService = getBulletDataService();
      await bulletService.deleteBullet(bulletId);
      await this.render(); // Refresh table
    } catch (error) {
      console.error('Failed to delete bullet:', error);
      alert('Failed to delete bullet point');
    }
  }

  /**
   * Refresh table data
   */
  async refresh(): Promise<void> {
    await this.render();
  }
}