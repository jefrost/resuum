/**
 * Bullets Table Component
 * Handles bullet points table rendering with state badges and sorting
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import type { Bullet, Role, Project, BulletFeatures } from '../types';

// ============================================================================
// Table State and Configuration
// ============================================================================

export type SortCriteria = 'role' | 'project' | 'created';
export type SortDirection = 'asc' | 'desc';

export interface TableState {
  sortBy: SortCriteria;
  sortDirection: SortDirection;
}

// ============================================================================
// Bullets Table Component
// ============================================================================

export class BulletsTable {
  private container: HTMLElement;
  private state: TableState = {
    sortBy: 'role',
    sortDirection: 'asc'
  };

  constructor(container: HTMLElement) {
    this.container = container;
  }

  // ============================================================================
  // Public Interface
  // ============================================================================

  /**
   * Render the complete bullets table
   */
  render(bullets: Bullet[], roles: Role[], projects: Project[]): void {
    this.container.innerHTML = '';
    
    const tableContainer = createSafeElement('div', '', 'table-container');
    
    // Create table controls
    const controls = this.createTableControls();
    tableContainer.appendChild(controls);
    
    // Create table
    const table = createSafeElement('table', '', 'bullets-table');
    const thead = this.createTableHeader();
    const tbody = this.createTableBody(bullets, roles, projects);
    
    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    this.container.appendChild(tableContainer);
  }

  /**
   * Update sort criteria and re-render if needed
   */
  updateSort(sortBy: SortCriteria, direction?: SortDirection): void {
    this.state.sortBy = sortBy;
    if (direction) {
      this.state.sortDirection = direction;
    }
  }

  /**
   * Get current sort state
   */
  getSortState(): TableState {
    return { ...this.state };
  }

  // ============================================================================
  // Table Controls
  // ============================================================================

  /**
   * Create table controls (sorting, filtering)
   */
  private createTableControls(): HTMLElement {
    const controls = createSafeElement('div', '', 'table-controls');
    
    const sortLabel = createSafeElement('label', 'Sort by: ', 'control-label');
    const sortSelect = document.createElement('select') as HTMLSelectElement;
    sortSelect.className = 'sort-select';
    
    const sortOptions = [
      { value: 'role', label: 'Role (Chronological)' },
      { value: 'project', label: 'Project Name' },
      { value: 'created', label: 'Created Date' }
    ];
    
    sortOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      setSafeTextContent(optionElement, option.label);
      if (option.value === this.state.sortBy) {
        optionElement.selected = true;
      }
      sortSelect.appendChild(optionElement);
    });
    
    sortSelect.addEventListener('change', () => {
      this.state.sortBy = sortSelect.value as SortCriteria;
      this.dispatchSortChange();
    });
    
    controls.appendChild(sortLabel);
    controls.appendChild(sortSelect);
    
    return controls;
  }

  /**
   * Dispatch custom event when sort changes
   */
  private dispatchSortChange(): void {
    const event = new CustomEvent('sort-change', {
      detail: { sortBy: this.state.sortBy, sortDirection: this.state.sortDirection }
    });
    this.container.dispatchEvent(event);
  }

  // ============================================================================
  // Table Structure
  // ============================================================================

  /**
   * Create table header
   */
  private createTableHeader(): HTMLElement {
    const thead = createSafeElement('thead', '', 'table-header');
    const headerRow = createSafeElement('tr', '', 'header-row');
    
    const headers = [
      { text: 'Role', class: 'role-header' },
      { text: 'Project', class: 'project-header' },
      { text: 'Bullet Text', class: 'text-header' },
      { text: 'State', class: 'state-header' },
      { text: 'Quality', class: 'quality-header' },
      { text: 'Created', class: 'created-header' }
    ];
    
    headers.forEach(header => {
      const th = createSafeElement('th', header.text, header.class);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    return thead;
  }

  /**
   * Create table body with sorted data
   */
  private createTableBody(bullets: Bullet[], roles: Role[], projects: Project[]): HTMLElement {
    const tbody = createSafeElement('tbody', '', 'table-body');
    const sortedBullets = this.sortBullets(bullets, roles, projects);
    
    sortedBullets.forEach(bullet => {
      const role = roles.find(r => r.id === bullet.roleId);
      const project = projects.find(p => p.id === bullet.projectId);
      
      if (role && project) {
        const row = this.createBulletRow(bullet, role, project);
        tbody.appendChild(row);
      }
    });
    
    return tbody;
  }

  // ============================================================================
  // Row Creation
  // ============================================================================

  /**
   * Create individual bullet row
   */
  private createBulletRow(bullet: Bullet, role: Role, project: Project): HTMLElement {
    const row = createSafeElement('tr', '', 'bullet-row');
    
    // Role cell
    const roleCell = createSafeElement('td', '', 'role-cell');
    setSafeTextContent(roleCell, `${role.title} - ${role.company}`);
    
    // Project cell
    const projectCell = createSafeElement('td', '', 'project-cell');
    setSafeTextContent(projectCell, project.name);
    
    // Text cell (truncated with hover for full text)
    const textCell = createSafeElement('td', '', 'text-cell');
    const truncatedText = bullet.text.length > 80 
      ? bullet.text.substring(0, 80) + '...' 
      : bullet.text;
    setSafeTextContent(textCell, truncatedText);
    textCell.title = bullet.text; // Full text on hover
    
    // State cell with badge
    const stateCell = createSafeElement('td', '', 'state-cell');
    const stateBadge = this.createStateBadge(bullet.embeddingState);
    stateCell.appendChild(stateBadge);
    
    // Quality cell with features
    const qualityCell = createSafeElement('td', '', 'quality-cell');
    const qualityIndicators = this.createQualityIndicators(bullet.features);
    qualityCell.appendChild(qualityIndicators);
    
    // Created cell
    const createdCell = createSafeElement('td', '', 'created-cell');
    const createdDate = new Date(bullet.createdAt).toLocaleDateString();
    setSafeTextContent(createdCell, createdDate);
    
    row.appendChild(roleCell);
    row.appendChild(projectCell);
    row.appendChild(textCell);
    row.appendChild(stateCell);
    row.appendChild(qualityCell);
    row.appendChild(createdCell);
    
    return row;
  }

  // ============================================================================
  // Badge and Indicator Creation
  // ============================================================================

  /**
   * Create embedding state badge with proper styling
   */
  private createStateBadge(state: string): HTMLElement {
    const badge = createSafeElement('span', '', `state-badge state-badge--${state}`);
    
    const stateConfig = {
      ready: { text: '✅ Ready', class: 'ready' },
      pending: { text: '⏳ Pending', class: 'pending' },
      stale: { text: '⚠️ Stale', class: 'stale' },
      failed: { text: '❌ Failed', class: 'failed' }
    };
    
    const config = stateConfig[state as keyof typeof stateConfig] || { text: '❓ Unknown', class: 'unknown' };
    setSafeTextContent(badge, config.text);
    
    return badge;
  }

  /**
   * Create quality feature indicators
   */
  private createQualityIndicators(features: BulletFeatures): HTMLElement {
    const container = createSafeElement('div', '', 'quality-indicators');
    
    const indicators = [
      { key: 'hasNumbers', symbol: '📊', active: features.hasNumbers, title: 'Has quantified results' },
      { key: 'actionVerb', symbol: '⚡', active: features.actionVerb, title: 'Strong action verb' },
      { key: 'lengthOk', symbol: '📏', active: features.lengthOk, title: 'Appropriate length' }
    ];
    
    indicators.forEach(indicator => {
      const span = createSafeElement('span', '', `quality-indicator ${indicator.active ? 'active' : 'inactive'}`);
      setSafeTextContent(span, indicator.symbol);
      span.title = indicator.title;
      container.appendChild(span);
    });
    
    return container;
  }

  // ============================================================================
  // Data Sorting (Deterministic as per Plan)
  // ============================================================================

  /**
   * Sort bullets based on current criteria with deterministic ordering
   */
  private sortBullets(bullets: Bullet[], roles: Role[], projects: Project[]): Bullet[] {
    return bullets.slice().sort((a, b) => {
      let comparison = 0;
      
      switch (this.state.sortBy) {
        case 'role':
          // Primary: Role order (chronological)
          const roleA = roles.find(r => r.id === a.roleId);
          const roleB = roles.find(r => r.id === b.roleId);
          if (roleA && roleB) {
            comparison = roleA.orderIndex - roleB.orderIndex;
            if (comparison === 0) {
              // Secondary: Project name
              const projectA = projects.find(p => p.id === a.projectId);
              const projectB = projects.find(p => p.id === b.projectId);
              if (projectA && projectB) {
                comparison = projectA.name.localeCompare(projectB.name);
              }
              if (comparison === 0) {
                // Tertiary: Created date
                comparison = a.createdAt - b.createdAt;
              }
            }
          }
          break;
          
        case 'project':
          // Primary: Project name
          const projA = projects.find(p => p.id === a.projectId);
          const projB = projects.find(p => p.id === b.projectId);
          if (projA && projB) {
            comparison = projA.name.localeCompare(projB.name);
            if (comparison === 0) {
                // Secondary: Created date for same project
                comparison = a.createdAt - b.createdAt;
              }
            }
            break;
            
          case 'created':
            // Primary: Created date
            comparison = a.createdAt - b.createdAt;
            if (comparison === 0) {
              // Secondary: Role order for same date
              const roleA = roles.find(r => r.id === a.roleId);
              const roleB = roles.find(r => r.id === b.roleId);
              if (roleA && roleB) {
                comparison = roleA.orderIndex - roleB.orderIndex;
              }
            }
            break;
        }
        
        return this.state.sortDirection === 'desc' ? -comparison : comparison;
      });
    }
  }