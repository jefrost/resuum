/**
 * Experience tab implementation with real data management
 */

import { BulletPointsTable, ProjectsTable } from './data-management';
import { getBulletEditor } from './bullet-editor';
import { createSafeElement } from './xss-safe-rendering';

// ============================================================================
// Experience Tab Class
// ============================================================================

export class ExperienceTab {
  private container: HTMLElement;
  private currentView: 'bullets' | 'projects' = 'bullets';
  private bulletsTable: BulletPointsTable;
  private projectsTable: ProjectsTable;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Create table instances
    const tableContainer = createSafeElement('div', '', 'table-container');
    this.bulletsTable = new BulletPointsTable(tableContainer);
    this.projectsTable = new ProjectsTable(tableContainer);
  }

  /**
   * Render the experience tab content
   */
  async render(): Promise<void> {
    this.container.innerHTML = '';
    
    // Create sub-navigation
    const subNav = this.createSubNavigation();
    
    // Create content area
    const content = createSafeElement('div', '', 'experience-content');
    
    this.container.appendChild(subNav);
    this.container.appendChild(content);
    
    // Render appropriate table
    if (this.currentView === 'bullets') {
      await this.bulletsTable.render();
      content.appendChild(this.bulletsTable['container']);
    } else {
      await this.projectsTable.render();
      content.appendChild(this.projectsTable['container']);
    }
  }

  /**
   * Create sub-navigation between bullets and projects views
   */
  private createSubNavigation(): HTMLElement {
    const nav = createSafeElement('nav', '', 'experience-subnav');
    
    const bulletsButton = createSafeElement('button', 'Bullet Points', 
      `subnav-button ${this.currentView === 'bullets' ? 'subnav-button--active' : ''}`);
    
    const projectsButton = createSafeElement('button', 'Projects',
      `subnav-button ${this.currentView === 'projects' ? 'subnav-button--active' : ''}`);
    
    bulletsButton.addEventListener('click', async () => {
      this.currentView = 'bullets';
      await this.render();
    });
    
    projectsButton.addEventListener('click', async () => {
      this.currentView = 'projects';
      await this.render();
    });
    
    nav.appendChild(bulletsButton);
    nav.appendChild(projectsButton);
    
    return nav;
  }
}