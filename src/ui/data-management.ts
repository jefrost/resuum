/**
 * Data management UI components for bullets and projects
 */

import { getAll, update, deleteById } from '../storage/transactions';
import { markBulletChanged } from '../storage/embedding-state';
import { createSafeElement, setSafeTextContent, renderBulletPoint } from './xss-safe-rendering';
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
    
    ['Role', 'Project', 'Bullet Text', 'State', 'Quality', 'Modified', 'Actions'].forEach(text => {
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
      const emptyCell = document.createElement('td'); // Use createElement instead
        emptyCell.textContent = 'No bullet points found';
        emptyCell.className = 'empty-state';
        emptyCell.colSpan = 7;
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
    const row = createSafeElement('tr', '', 
      `bullet-row bullet-row--${bullet.embeddingState}`);
    
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
    const bulletElement = renderBulletPoint(bullet.text, bullet.embeddingState);
    if (bullet.text.length > 80) {
      const truncatedText = bullet.text.substring(0, 80) + '...';
      setSafeTextContent(bulletElement.querySelector('.bullet-text') || bulletElement, truncatedText);
      bulletElement.title = bullet.text;
    }
    textCell.appendChild(bulletElement);
    
    // Embedding state
    const stateCell = createSafeElement('td', '', 'state-cell');
    const stateBadge = this.createStateBadge(bullet);
    stateCell.appendChild(stateBadge);
    
    // Quality indicators
    const qualityCell = createSafeElement('td', '', 'quality-cell');
    const qualityBadges = this.createQualityBadges(bullet);
    qualityCell.appendChild(qualityBadges);
    
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
    row.appendChild(stateCell);
    row.appendChild(qualityCell);
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
    
    for (const project of roleProjects) {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    }
    
    select.addEventListener('change', async (e) => {
      const newProjectId = (e.target as HTMLSelectElement).value;
      await this.moveBulletToProject(bullet.id, newProjectId);
    });
    
    return select;
  }

  /**
   * Create embedding state badge
   */
  private createStateBadge(bullet: Bullet): HTMLElement {
    const badge = createSafeElement('span', '', 
      `state-badge state-badge--${bullet.embeddingState}`);
    
    const stateLabels = {
      ready: '✓ Ready',
      pending: '⏳ Processing',
      stale: '⚠ Needs Update',
      failed: '✗ Failed'
    };
    
    setSafeTextContent(badge, stateLabels[bullet.embeddingState] || '? Unknown');
    
    if (bullet.embeddingState === 'failed' && bullet.retryCount > 0) {
      badge.title = `Failed after ${bullet.retryCount} retries`;
    }
    
    return badge;
  }

  /**
   * Create quality feature badges
   */
  private createQualityBadges(bullet: Bullet): HTMLElement {
    const container = createSafeElement('div', '', 'quality-badges');
    
    const features = [
      { key: 'hasNumbers', label: '#', title: 'Contains numbers' },
      { key: 'actionVerb', label: 'V', title: 'Strong action verb' },
      { key: 'lengthOk', label: 'L', title: 'Good length' }
    ];
    
    for (const feature of features) {
      const badge = createSafeElement('span', feature.label, 
        `quality-badge ${bullet.features[feature.key as keyof typeof bullet.features] ? 'quality-badge--active' : 'quality-badge--inactive'}`
      );
      badge.title = feature.title;
      container.appendChild(badge);
    }
    
    return container;
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

  /**
   * Get filtered and sorted bullets
   */
  private getFilteredAndSortedBullets(): Bullet[] {
    let filtered = this.bullets;
    
    // Apply text filter
    if (this.filterText) {
      const filter = this.filterText.toLowerCase();
      filtered = filtered.filter(bullet => 
        bullet.text.toLowerCase().includes(filter)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (this.sortBy) {
        case 'created':
          compareValue = a.createdAt - b.createdAt;
          break;
        case 'modified':
          compareValue = a.lastModified - b.lastModified;
          break;
        case 'role':
          const roleA = this.roles.find(r => r.id === a.roleId);
          const roleB = this.roles.find(r => r.id === b.roleId);
          compareValue = (roleA?.orderIndex || 0) - (roleB?.orderIndex || 0);
          break;
        case 'project':
          const projectA = this.projects.find(p => p.id === a.projectId);
          const projectB = this.projects.find(p => p.id === b.projectId);
          compareValue = (projectA?.name || '').localeCompare(projectB?.name || '');
          break;
      }
      
      return this.sortOrder === 'desc' ? -compareValue : compareValue;
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
      
      // Mark as changed for re-embedding
      await markBulletChanged(bulletId);
      
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
    const editor = getBulletEditor();
    editor.showAddModal('role_mckinsey_sc', undefined, () => {
      this.render(); // Refresh the current sample data display
    });
  }
  
  private editBullet(bulletId: string): void {
    const editor = getBulletEditor();
    editor.showEditModal(bulletId, () => this.render());
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
    
    ['Role', 'Project Name', 'Description', '# Bullets', 'Embedding Status', 'Actions'].forEach(text => {
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
      const emptyCell = document.createElement('td'); // Use createElement instead
      emptyCell.textContent = 'No projects found';
      emptyCell.className = 'empty-state';
      emptyCell.colSpan = 6;
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
      project.description.length > 60 ? 
        project.description.substring(0, 60) + '...' : 
        project.description
    );
    if (project.description.length > 60) {
      descCell.title = project.description;
    }
    
    // Bullet count with accuracy indicator
    const projectBullets = this.bullets.filter(b => b.projectId === project.id);
    const actualCount = projectBullets.length;
    const storedCount = project.bulletCount;
    
    const countCell = createSafeElement('td', '', 'count-cell');
    const countText = createSafeElement('span', actualCount.toString());
    
    if (actualCount !== storedCount) {
      countText.className = 'count-mismatch';
      countText.title = `Stored count: ${storedCount}, Actual: ${actualCount}`;
    }
    
    countCell.appendChild(countText);
    
    // Embedding status
    const statusCell = createSafeElement('td', '', 'status-cell');
    const statusBadge = this.createEmbeddingStatusBadge(project, projectBullets);
    statusCell.appendChild(statusBadge);
    
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
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    return row;
  }

  /**
   * Create embedding status badge for project
   */
  private createEmbeddingStatusBadge(project: Project, bullets: Bullet[]): HTMLElement {
    const badge = createSafeElement('div', '', 'embedding-status');
    
    if (bullets.length === 0) {
      badge.className += ' embedding-status--empty';
      setSafeTextContent(badge, 'No bullets');
      return badge;
    }
    
    const stateCounts = {
      ready: 0,
      pending: 0,
      stale: 0,
      failed: 0
    };
    
    bullets.forEach(bullet => {
      stateCounts[bullet.embeddingState]++;
    });
    
    // Determine overall status
    if (stateCounts.failed > 0) {
      badge.className += ' embedding-status--failed';
      setSafeTextContent(badge, `${stateCounts.failed} failed`);
    } else if (stateCounts.pending > 0) {
      badge.className += ' embedding-status--pending';
      setSafeTextContent(badge, `${stateCounts.pending} processing`);
    } else if (stateCounts.stale > 0) {
      badge.className += ' embedding-status--stale';
      setSafeTextContent(badge, `${stateCounts.stale} stale`);
    } else {
      badge.className += ' embedding-status--ready';
      setSafeTextContent(badge, 'All ready');
    }
    
    // Add centroid status
    const hasValidCentroid = project.centroidVector.byteLength > 0;
    if (!hasValidCentroid) {
      badge.className += ' embedding-status--no-centroid';
      badge.title = 'Project centroid needs calculation';
    }
    
    return badge;
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

  /**
   * Show add project modal
   */
  private showAddProjectModal(): void {
    const editor = getProjectEditor();
    const firstRole = this.roles[0];
    const defaultRoleId = firstRole ? firstRole.id : undefined;
    
    editor.showAddModal(defaultRoleId, () => this.render());
  }

  /**
   * Edit project
   */
  private editProject(projectId: string): void {
    const editor = getProjectEditor();
    editor.showEditModal(projectId, () => this.render());
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
        `Deleting it will move them to "No Project". Continue?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Move bullets to "No Project" for this role
      // Implementation would go here
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
}