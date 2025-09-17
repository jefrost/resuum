/**
 * Data management UI components for bullets and projects
 * Fixed for simplified data model
 */

import { getAll, update, deleteById } from '../storage/transactions';
import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import type { Bullet, Project, Role } from '../types';
import { getBulletEditor } from './bullet-editor';
import { getProjectEditor } from './project-editor';

// ============================================================================
// Bullet Points Table Component
// ============================================================================

export class BulletPointsTable {
  private container: HTMLElement;
  private bullets: Bullet[] = [];
  private projects: Project[] = [];
  private roles: Role[] = [];
  private sortBy: 'role' | 'project' | 'created' | 'modified' = 'created';
  private sortOrder: 'asc' | 'desc' = 'desc';
  private filterText = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render the bullets table
   */
  async render(): Promise<void> {
    await this.loadData();
    
    this.container.innerHTML = '';
    
    // Create header with controls
    const header = this.createHeader();
    const table = await this.createTable();
    
    this.container.appendChild(header);
    this.container.appendChild(table);
  }

  /**
   * Create table header with controls
   */
  private createHeader(): HTMLElement {
    const header = createSafeElement('div', '', 'bullets-header');
    
    // Add bullet button
    const addButton = createSafeElement('button', '+ Add Bullet Point', 'btn btn-primary');
    addButton.addEventListener('click', () => this.showAddBulletModal());
    
    // Filter input
    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.placeholder = 'Filter bullets...';
    filterInput.className = 'filter-input';
    filterInput.value = this.filterText;
    filterInput.addEventListener('input', (e) => {
      this.filterText = (e.target as HTMLInputElement).value;
      this.render();
    });
    
    // Sort controls
    const sortSelect = document.createElement('select');
    sortSelect.className = 'sort-select';
    [
      { value: 'created', label: 'Created Date' },
      { value: 'modified', label: 'Modified Date' },
      { value: 'role', label: 'Role' },
      { value: 'project', label: 'Project' }
    ].forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      opt.selected = this.sortBy === option.value;
      sortSelect.appendChild(opt);
    });
    
    sortSelect.addEventListener('change', (e) => {
      this.sortBy = (e.target as HTMLSelectElement).value as any;
      this.render();
    });
    
    const orderButton = createSafeElement('button', 
      this.sortOrder === 'asc' ? '↑' : '↓', 
      'btn btn-sm'
    );
    orderButton.addEventListener('click', () => {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      this.render();
    });
    
    header.appendChild(addButton);
    header.appendChild(filterInput);
    header.appendChild(sortSelect);
    header.appendChild(orderButton);
    
    return header;
  }

  /**
   * Create the bullets table
   */
  private async createTable(): Promise<HTMLElement> {
    const table = createSafeElement('table', '', 'bullets-table data-table');
    
    // Header
    const thead = createSafeElement('thead');
    const headerRow = createSafeElement('tr');
    
    ['Role', 'Project', 'Bullet Text', 'Modified', 'Actions'].forEach(text => {
      const th = createSafeElement('th', text);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = createSafeElement('tbody');
    const filteredBullets = this.getFilteredAndSortedBullets();
    
    for (const bullet of filteredBullets) {
      const row = await this.createBulletRow(bullet);
      tbody.appendChild(row);
    }
    
    if (filteredBullets.length === 0) {
      const emptyRow = createSafeElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.textContent = 'No bullet points found';
      emptyCell.className = 'empty-state';
      emptyCell.colSpan = 5;
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }
    
    table.appendChild(tbody);
    return table;
  }

  /**
   * Create a single bullet row
   */
  private async createBulletRow(bullet: Bullet): Promise<HTMLElement> {
    const row = createSafeElement('tr', '', 'bullet-row');
    
    // Role
    const role = this.roles.find(r => r.id === bullet.roleId);
    const roleCell = createSafeElement('td', 
      role ? `${role.title}\n${role.company}` : 'Unknown Role',
      'role-cell'
    );
    
    // Project with edit dropdown
    const projectCell = createSafeElement('td', '', 'project-cell');
    const projectSelect = await this.createProjectSelect(bullet);
    projectCell.appendChild(projectSelect);
    
    // Bullet text (truncated with full text on hover)
    const textCell = createSafeElement('td', '', 'text-cell');
    const truncatedText = bullet.text.length > 80 
      ? bullet.text.substring(0, 80) + '...'
      : bullet.text;
    setSafeTextContent(textCell, truncatedText);
    textCell.title = bullet.text; // Full text on hover
    
    // Modified date
    const modifiedCell = createSafeElement('td', 
      new Date(bullet.lastModified).toLocaleDateString(),
      'date-cell'
    );
    
    // Actions
    const actionsCell = createSafeElement('td', '', 'actions-cell');
    const editButton = createSafeElement('button', 'Edit', 'btn btn-sm');
    const deleteButton = createSafeElement('button', 'Delete', 'btn btn-sm btn-danger');
    
    editButton.addEventListener('click', () => this.editBullet(bullet.id));
    deleteButton.addEventListener('click', () => this.deleteBullet(bullet.id));
    
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);
    
    row.appendChild(roleCell);
    row.appendChild(projectCell);
    row.appendChild(textCell);
    row.appendChild(modifiedCell);
    row.appendChild(actionsCell);
    
    return row;
  }

  /**
   * Create project selection dropdown for bullet
   */
  private async createProjectSelect(bullet: Bullet): Promise<HTMLElement> {
    const select = document.createElement('select');
    select.className = 'project-select';
    
    const currentProject = this.projects.find(p => p.id === bullet.projectId);
    
    // Add current project first
    if (currentProject) {
      const currentOption = document.createElement('option');
      currentOption.value = currentProject.id;
      currentOption.textContent = currentProject.name;
      currentOption.selected = true;
      select.appendChild(currentOption);
    }
    
    // Add other projects for the same role
    const roleProjects = this.projects.filter(p => 
      p.roleId === bullet.roleId && p.id !== bullet.projectId
    );
    
    roleProjects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
    
    // Handle project change
    select.addEventListener('change', () => {
      this.moveBulletToProject(bullet.id, select.value);
    });
    
    return select;
  }

  /**
   * Get filtered and sorted bullets
   */
  private getFilteredAndSortedBullets(): Bullet[] {
    let filtered = this.bullets;
    
    // Apply text filter
    if (this.filterText) {
      const filterLower = this.filterText.toLowerCase();
      filtered = filtered.filter(bullet => {
        const role = this.roles.find(r => r.id === bullet.roleId);
        const project = this.projects.find(p => p.id === bullet.projectId);
        
        return bullet.text.toLowerCase().includes(filterLower) ||
               role?.title.toLowerCase().includes(filterLower) ||
               role?.company.toLowerCase().includes(filterLower) ||
               project?.name.toLowerCase().includes(filterLower);
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (this.sortBy) {
        case 'role':
          const roleA = this.roles.find(r => r.id === a.roleId)?.title || '';
          const roleB = this.roles.find(r => r.id === b.roleId)?.title || '';
          compareValue = roleA.localeCompare(roleB);
          break;
        case 'project':
          const projectA = this.projects.find(p => p.id === a.projectId)?.name || '';
          const projectB = this.projects.find(p => p.id === b.projectId)?.name || '';
          compareValue = projectA.localeCompare(projectB);
          break;
        case 'created':
          compareValue = a.createdAt - b.createdAt;
          break;
        case 'modified':
          compareValue = a.lastModified - b.lastModified;
          break;
      }
      
      return this.sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    return filtered;
  }

  /**
   * Move bullet to different project
   */
  private async moveBulletToProject(bulletId: string, newProjectId: string): Promise<void> {
    try {
      const bullet = this.bullets.find(b => b.id === bulletId);
      if (!bullet) return;
      
      const updatedBullet: Bullet = {
        ...bullet,
        projectId: newProjectId,
        lastModified: Date.now()
      };
      
      await update('bullets', updatedBullet);
      
      // Refresh display
      await this.render();
      
    } catch (error) {
      console.error('Failed to move bullet:', error);
      alert('Failed to move bullet point');
    }
  }

  /**
   * Show add bullet modal
   */
  private showAddBulletModal(): void {
    try {
      const editor = getBulletEditor();
      editor.showAddModal(undefined, undefined, () => {
        this.render(); // Refresh the display
      });
    } catch (error) {
      console.error('Error showing add modal:', error);
      alert('Error opening bullet editor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
  
  private editBullet(bulletId: string): void {
    try {
      const editor = getBulletEditor();
      editor.showEditModal(bulletId, () => this.render());
    } catch (error) {
      console.error('Error editing bullet:', error);
      alert('Error opening bullet editor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Delete bullet
   */
  private async deleteBullet(bulletId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this bullet point?')) {
      return;
    }
    
    try {
      await deleteById('bullets', bulletId);
      await this.render();
    } catch (error) {
      console.error('Failed to delete bullet:', error);
      alert('Failed to delete bullet point');
    }
  }

  /**
   * Load data from storage
   */
  private async loadData(): Promise<void> {
    [this.bullets, this.projects, this.roles] = await Promise.all([
      getAll<Bullet>('bullets'),
      getAll<Project>('projects'),
      getAll<Role>('roles')
    ]);
  }
}

// ============================================================================
// Projects Table Component
// ============================================================================

export class ProjectsTable {
  private container: HTMLElement;
  private projects: Project[] = [];
  private roles: Role[] = [];
  private bullets: Bullet[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render the projects table
   */
  async render(): Promise<void> {
    await this.loadData();
    
    this.container.innerHTML = '';
    
    const header = this.createHeader();
    const table = this.createTable();
    
    this.container.appendChild(header);
    this.container.appendChild(table);
  }

  /**
   * Create header with add button
   */
  private createHeader(): HTMLElement {
    const header = createSafeElement('div', '', 'projects-header');
    
    const addButton = createSafeElement('button', '+ Add Project', 'btn btn-primary');
    addButton.addEventListener('click', () => this.showAddProjectModal());
    
    header.appendChild(addButton);
    return header;
  }

  /**
   * Create projects table
   */
  private createTable(): HTMLElement {
    const table = createSafeElement('table', '', 'projects-table data-table');
    
    // Header
    const thead = createSafeElement('thead');
    const headerRow = createSafeElement('tr');
    
    ['Role', 'Project Name', 'Description', '# Bullets', 'Actions'].forEach((text) => {
      const th = createSafeElement('th', text);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = createSafeElement('tbody');
    
    for (const project of this.projects) {
      const row = this.createProjectRow(project);
      tbody.appendChild(row);
    }
    
    if (this.projects.length === 0) {
      const emptyRow = createSafeElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.textContent = 'No projects found';
      emptyCell.className = 'empty-state';
      emptyCell.colSpan = 5;
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }
    
    table.appendChild(tbody);
    return table;
  }

  /**
   * Create project row
   */
  private createProjectRow(project: Project): HTMLElement {
    const row = createSafeElement('tr', '', 'project-row');
    
    // Role
    const role = this.roles.find(r => r.id === project.roleId);
    const roleCell = createSafeElement('td', 
      role ? `${role.title}\n${role.company}` : 'Unknown Role'
    );
    
    // Project name
    const nameCell = createSafeElement('td', project.name, 'project-name');
    
    // Description
    const descCell = createSafeElement('td', 
      project.description && project.description.length > 60 
        ? project.description.substring(0, 60) + '...'
        : project.description || 'No description'
    );
    
    // Bullet count
    const bulletCount = this.bullets.filter(b => b.projectId === project.id).length;
    const countCell = createSafeElement('td', bulletCount.toString());
    
    // Actions
    const actionsCell = createSafeElement('td', '', 'actions-cell');
    const editButton = createSafeElement('button', 'Edit', 'btn btn-sm');
    const deleteButton = createSafeElement('button', 'Delete', 'btn btn-sm btn-danger');
    
    editButton.addEventListener('click', () => this.editProject(project.id));
    deleteButton.addEventListener('click', () => this.deleteProject(project.id));
    
    actionsCell.appendChild(editButton);
    actionsCell.appendChild(deleteButton);
    
    row.appendChild(roleCell);
    row.appendChild(nameCell);
    row.appendChild(descCell);
    row.appendChild(countCell);
    row.appendChild(actionsCell);
    
    return row;
  }

  /**
   * Show add project modal
   */
  private showAddProjectModal(): void {
    try {
      const editor = getProjectEditor();
      editor.showAddModal(undefined, () => this.render());
    } catch (error) {
      console.error('Error showing add project modal:', error);
      alert('Error opening project editor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Edit project
   */
  private editProject(projectId: string): void {
    try {
      const editor = getProjectEditor();
      editor.showEditModal(projectId, () => this.render());
    } catch (error) {
      console.error('Error editing project:', error);
      alert('Error opening project editor: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Delete project
   */
  private async deleteProject(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const projectBullets = this.bullets.filter(b => b.projectId === projectId);
    
    if (projectBullets.length > 0) {
      const confirmMessage = `This project has ${projectBullets.length} bullet points. ` +
        `Deleting it will remove them. Continue?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }
    
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }
    
    try {
      await deleteById('projects', projectId);
      await this.render();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    }
  }

  /**
   * Load data from storage
   */
  private async loadData(): Promise<void> {
    [this.projects, this.roles, this.bullets] = await Promise.all([
      getAll<Project>('projects'),
      getAll<Role>('roles'),
      getAll<Bullet>('bullets')
    ]);
  }
}