/**
 * Experience Tab Implementation
 * Fixed to work with simplified data model
 */

import { BulletPointsTable, ProjectsTable } from './data-management';
import { createSafeElement } from './xss-safe-rendering';

// ============================================================================
// Experience Tab Class
// ============================================================================

export class ExperienceTab {
  private container: HTMLElement;
  private currentView: 'bullets' | 'projects' = 'bullets';
  private bulletsTable: BulletPointsTable | null = null;
  private projectsTable: ProjectsTable | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    console.log('ExperienceTab constructor called with container:', container);
  }

  /**
   * Render the experience tab content
   */
  async render(): Promise<void> {
    console.log('ExperienceTab render() called');
    
    try {
      this.container.innerHTML = '';
      
      // Create main layout
      const tabContent = createSafeElement('div', '', 'experience-tab-content');
      
      // Create sub-navigation
      const subNav = this.createSubNavigation();
      
      // Create content area
      const contentArea = createSafeElement('div', '', 'experience-content');
      
      tabContent.appendChild(subNav);
      tabContent.appendChild(contentArea);
      this.container.appendChild(tabContent);
      
      console.log('ExperienceTab basic structure created, rendering current view...');
      
      // Render the appropriate view
      await this.renderCurrentView(contentArea);
      
      console.log('ExperienceTab render completed successfully');
      
    } catch (error) {
      console.error('Error in ExperienceTab.render():', error);
      
      // Show error in the container
      this.container.innerHTML = `
        <div style="color: red; padding: 1rem; border: 1px solid #ff0000; border-radius: 4px;">
          <h3>Experience Tab Render Error</h3>
          <p>Error rendering experience tab: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  }

  /**
   * Create sub-navigation between bullets and projects
   */
  private createSubNavigation(): HTMLElement {
    const nav = createSafeElement('div', '', 'experience-subnav');
    
    const bulletsButton = createSafeElement('button', 'Bullet Points', 
      `subnav-button ${this.currentView === 'bullets' ? 'subnav-button--active' : ''}`
    );
    
    const projectsButton = createSafeElement('button', 'Projects',
      `subnav-button ${this.currentView === 'projects' ? 'subnav-button--active' : ''}`
    );
    
    // Add button handlers
    bulletsButton.addEventListener('click', async () => {
      if (this.currentView !== 'bullets') {
        this.currentView = 'bullets';
        await this.render();
      }
    });
    
    projectsButton.addEventListener('click', async () => {
      if (this.currentView !== 'projects') {
        this.currentView = 'projects';
        await this.render();
      }
    });
    
    nav.appendChild(bulletsButton);
    nav.appendChild(projectsButton);
    
    return nav;
  }

  /**
   * Render the current view content
   */
  private async renderCurrentView(contentArea: HTMLElement): Promise<void> {
    contentArea.innerHTML = '';
    
    if (this.currentView === 'bullets') {
      await this.renderBulletsView(contentArea);
    } else {
      await this.renderProjectsView(contentArea);
    }
  }

  /**
   * Render bullets view - FIXED to actually use BulletPointsTable
   */
  private async renderBulletsView(contentArea: HTMLElement): Promise<void> {
    try {
      console.log('Rendering bullets view...');
      
      // Create bullets table container
      const tableContainer = createSafeElement('div', '', 'bullets-table-container');
      contentArea.appendChild(tableContainer);
      
      // Actually use the BulletPointsTable (not BulletsTable)
      this.bulletsTable = new BulletPointsTable(tableContainer);
      await this.bulletsTable.render();
      
      console.log('Bullets view rendered successfully');
      
    } catch (error) {
      console.error('Error rendering bullets view:', error);
      
      // Show fallback content
      contentArea.innerHTML = `
        <div style="padding: 1rem;">
          <h3>Bullets</h3>
          <p style="color: orange;">Error loading bullets table: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>The bullets functionality is being updated. Please check back soon.</p>
        </div>
      `;
    }
  }

  /**
   * Render projects view - FIXED to actually use ProjectsTable
   */
  private async renderProjectsView(contentArea: HTMLElement): Promise<void> {
    try {
      console.log('Rendering projects view...');
      
      // Create projects table container
      const tableContainer = createSafeElement('div', '', 'projects-table-container');
      contentArea.appendChild(tableContainer);
      
      // Actually use the ProjectsTable instead of placeholder text
      this.projectsTable = new ProjectsTable(tableContainer);
      await this.projectsTable.render();
      
      console.log('Projects view rendered successfully');
      
    } catch (error) {
      console.error('Error rendering projects view:', error);
      
      // Show fallback content
      contentArea.innerHTML = `
        <div style="padding: 1rem;">
          <h3>Projects</h3>
          <p style="color: orange;">Error loading projects interface: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>The projects functionality is being updated. Please check back soon.</p>
        </div>
      `;
    }
  }

  /**
   * Refresh the current view
   */
  async refresh(): Promise<void> {
    await this.render();
  }
}