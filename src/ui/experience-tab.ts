/**
 * Experience Tab Main Coordinator
 * Manages the Experience tab with sub-navigation and state summary
 */

import { createSafeElement, setSafeTextContent } from '../ui/xss-safe-rendering';
import { BulletsTable } from '../ui/bullets-table';
import { 
  getSampleDataset, 
  getEmbeddingStateSummary 
} from '../data/sample-data';
import type { Bullet, Role, Project } from '../types/index';

// ============================================================================
// Experience Tab State
// ============================================================================

type SubTabView = 'bullets' | 'projects';

export interface ExperienceTabState {
  currentSubTab: SubTabView;
  lastUpdate: number;
}

// ============================================================================
// Experience Tab Class
// ============================================================================

export class ExperienceTab {
  private container: HTMLElement;
  private state: ExperienceTabState = {
    currentSubTab: 'bullets',
    lastUpdate: Date.now()
  };
  private bulletsTable: BulletsTable | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  // ============================================================================
  // Public Interface
  // ============================================================================

  /**
   * Render the complete Experience tab
   */
  render(): void {
    this.container.innerHTML = '';
    
    const tabContainer = createSafeElement('div', '', 'experience-tab');
    
    // Create header with summary
    const header = this.createHeader();
    tabContainer.appendChild(header);
    
    // Create sub-navigation
    const subNav = this.createSubNavigation();
    tabContainer.appendChild(subNav);
    
    // Create main content area
    const content = this.createMainContent();
    tabContainer.appendChild(content);
    
    this.container.appendChild(tabContainer);
  }

  /**
   * Switch to specific sub-tab
   */
  switchSubTab(subTab: SubTabView): void {
    this.state.currentSubTab = subTab;
    this.state.lastUpdate = Date.now();
    this.render();
  }

  /**
   * Get current tab state
   */
  getState(): ExperienceTabState {
    return { ...this.state };
  }

  // ============================================================================
  // Header and Summary
  // ============================================================================

  /**
   * Create tab header with embedding state summary
   */
  private createHeader(): HTMLElement {
    const header = createSafeElement('div', '', 'experience-header');
    
    const title = createSafeElement('h2', 'Experience Management', 'section-title');
    const summary = this.createEmbeddingStateSummary();
    
    header.appendChild(title);
    header.appendChild(summary);
    
    return header;
  }

  /**
   * Create embedding state summary display
   */
  private createEmbeddingStateSummary(): HTMLElement {
    const summaryContainer = createSafeElement('div', '', 'embedding-summary');
    const stateSummary = getEmbeddingStateSummary();
    
    const summaryText = createSafeElement('p', '', 'summary-text');
    setSafeTextContent(summaryText, 
      `${stateSummary.total} bullet points: ${stateSummary.ready} ready, ${stateSummary.pending} pending, ${stateSummary.stale} stale, ${stateSummary.failed} failed`
    );
    
    // Add state indicator badges
    const badgesContainer = createSafeElement('div', '', 'state-badges');
    
    const stateTypes = [
      { key: 'ready', label: 'Ready', count: stateSummary.ready, class: 'ready' },
      { key: 'pending', label: 'Pending', count: stateSummary.pending, class: 'pending' },
      { key: 'stale', label: 'Stale', count: stateSummary.stale, class: 'stale' },
      { key: 'failed', label: 'Failed', count: stateSummary.failed, class: 'failed' }
    ];
    
    stateTypes.forEach(state => {
      const badge = createSafeElement('span', '', `summary-badge summary-badge--${state.class}`);
      setSafeTextContent(badge, `${state.label}: ${state.count}`);
      badgesContainer.appendChild(badge);
    });
    
    summaryContainer.appendChild(summaryText);
    summaryContainer.appendChild(badgesContainer);
    
    return summaryContainer;
  }

  // ============================================================================
  // Sub-Navigation
  // ============================================================================

  /**
   * Create sub-navigation for Bullets/Projects views
   */
  private createSubNavigation(): HTMLElement {
    const nav = createSafeElement('nav', '', 'experience-sub-nav');
    const navList = createSafeElement('ul', '', 'sub-nav-list');
    
    const bulletsItem = this.createSubNavItem('bullets', 'Bullet Points', this.state.currentSubTab === 'bullets');
    const projectsItem = this.createSubNavItem('projects', 'Projects', this.state.currentSubTab === 'projects');
    
    navList.appendChild(bulletsItem);
    navList.appendChild(projectsItem);
    nav.appendChild(navList);
    
    return nav;
  }

  /**
   * Create individual sub-navigation item
   */
  private createSubNavItem(view: SubTabView, label: string, isActive: boolean): HTMLElement {
    const listItem = createSafeElement('li', '', 'sub-nav-item');
    const button = document.createElement('button');
    
    button.className = `sub-nav-button ${isActive ? 'sub-nav-button--active' : ''}`;
    setSafeTextContent(button, label);
    
    button.addEventListener('click', () => {
      this.switchSubTab(view);
    });
    
    listItem.appendChild(button);
    return listItem;
  }

  // ============================================================================
  // Main Content
  // ============================================================================

  /**
   * Create main content area
   */
  private createMainContent(): HTMLElement {
    const content = createSafeElement('div', '', 'experience-content');
    
    if (this.state.currentSubTab === 'bullets') {
      const tableContainer = this.createBulletsView();
      content.appendChild(tableContainer);
    } else {
      const projectsView = this.createProjectsView();
      content.appendChild(projectsView);
    }
    
    return content;
  }

  /**
   * Create bullets table view
   */
  private createBulletsView(): HTMLElement {
    const container = createSafeElement('div', '', 'bullets-view');
    const { bullets, roles, projects } = getSampleDataset();
    
    // Create bullets table instance
    this.bulletsTable = new BulletsTable(container);
    
    // Listen for sort changes
    container.addEventListener('sort-change', (event: Event) => {
        const customEvent = event as CustomEvent;
        // Handle sort change if needed
        console.log('Sort changed:', customEvent.detail);
      });
    
    // Render the table
    this.bulletsTable.render(bullets, roles, projects);
    
    return container;
  }

  /**
   * Create projects overview view
   */
  private createProjectsView(): HTMLElement {
    const container = createSafeElement('div', '', 'projects-view');
    
    const table = this.createProjectsTable();
    container.appendChild(table);
    
    return container;
  }

  // ============================================================================
  // Projects Table
  // ============================================================================

  /**
   * Create projects overview table
   */
  private createProjectsTable(): HTMLElement {
    const tableContainer = createSafeElement('div', '', 'table-container');
    
    const table = createSafeElement('table', '', 'projects-table');
    const thead = this.createProjectsTableHeader();
    const tbody = this.createProjectsTableBody();
    
    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    return tableContainer;
  }

  /**
   * Create projects table header
   */
  private createProjectsTableHeader(): HTMLElement {
    const thead = createSafeElement('thead', '', 'table-header');
    const headerRow = createSafeElement('tr', '', 'header-row');
    
    const headers = [
      { text: 'Role', class: 'role-header' },
      { text: 'Project Name', class: 'project-header' },
      { text: '# Bullets', class: 'count-header' },
      { text: 'Description', class: 'description-header' }
    ];
    
    headers.forEach(header => {
      const th = createSafeElement('th', header.text, header.class);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    return thead;
  }

  /**
   * Create projects table body with deterministic ordering
   */
  private createProjectsTableBody(): HTMLElement {
    const tbody = createSafeElement('tbody', '', 'table-body');
    const { roles, projects } = getSampleDataset();
    
    // Sort projects by role order, then by project name (deterministic)
const sortedProjects = projects.slice().sort((a: Project, b: Project) => {
      const roleA = roles.find((r: Role) => r.id === a.roleId);
      const roleB = roles.find((r: Role) => r.id === b.roleId);
      
      if (roleA && roleB) {
        if (roleA.orderIndex !== roleB.orderIndex) {
          return roleA.orderIndex - roleB.orderIndex;
        }
      }
      return a.name.localeCompare(b.name);
    });
    
    sortedProjects.forEach((project: Project) => {
        const role = roles.find((r: Role) => r.id === project.roleId);
      if (role) {
        const row = this.createProjectRow(project, role);
        tbody.appendChild(row);
      }
    });
    
    return tbody;
  }

  /**
   * Create individual project row
   */
  private createProjectRow(project: Project, role: Role): HTMLElement {
    const row = createSafeElement('tr', '', 'project-row');
    
    // Role cell
    const roleCell = createSafeElement('td', '', 'role-cell');
    setSafeTextContent(roleCell, `${role.title} - ${role.company}`);
    
    // Project name cell
    const nameCell = createSafeElement('td', '', 'name-cell');
    setSafeTextContent(nameCell, project.name);
    
    // Bullet count cell
    const countCell = createSafeElement('td', '', 'count-cell');
    setSafeTextContent(countCell, project.bulletCount.toString());
    
    // Description cell
    const descCell = createSafeElement('td', '', 'description-cell');
    const description = project.description || 'No description';
    const truncatedDesc = description.length > 60 
      ? description.substring(0, 60) + '...' 
      : description;
    setSafeTextContent(descCell, truncatedDesc);
    descCell.title = description; // Full description on hover
    
    row.appendChild(roleCell);
    row.appendChild(nameCell);
    row.appendChild(countCell);
    row.appendChild(descCell);
    
    return row;
  }
}