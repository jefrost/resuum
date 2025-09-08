/**
 * Settings Tab - Main Coordinator
 * Assembles API config, role management, and data management sections
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { APIConfig } from './api-config';
import { RoleManager } from './role-manager';
import { getAll } from '../storage/transactions';

// ============================================================================
// Settings Tab Class
// ============================================================================

export class SettingsTab {
  private container: HTMLElement;
  private apiConfig: APIConfig;
  private roleManager: RoleManager;

  constructor(container: HTMLElement) {
    this.container = container;
    this.apiConfig = new APIConfig();
    this.roleManager = new RoleManager();
  }

  // ============================================================================
  // Public Interface
  // ============================================================================

  /**
   * Render the Settings tab content
   */
  async render(): Promise<void> {
    this.container.innerHTML = '';
    
    const tabContainer = createSafeElement('div', '', 'settings-tab');
    
    // Create sections
    const apiSection = await this.createAPISection();
    const roleSection = await this.createRoleSection();
    const dataSection = await this.createDataSection();
    
    tabContainer.appendChild(apiSection);
    tabContainer.appendChild(roleSection);
    tabContainer.appendChild(dataSection);
    
    this.container.appendChild(tabContainer);
  }

  // ============================================================================
  // Section Creation
  // ============================================================================

  /**
   * Create API configuration section
   */
  private async createAPISection(): Promise<HTMLElement> {
    const section = createSafeElement('section', '', 'settings-section');
    const title = createSafeElement('h2', 'AI Configuration', 'section-title');
    
    const configContainer = createSafeElement('div', '', 'api-config-container');
    await this.apiConfig.render(configContainer);
    
    section.appendChild(title);
    section.appendChild(configContainer);
    
    return section;
  }

  /**
   * Create role management section
   */
  private async createRoleSection(): Promise<HTMLElement> {
    const section = createSafeElement('section', '', 'settings-section');
    const title = createSafeElement('h2', 'Role Management', 'section-title');
    
    const managerContainer = createSafeElement('div', '', 'role-manager-container');
    await this.roleManager.render(managerContainer);
    
    section.appendChild(title);
    section.appendChild(managerContainer);
    
    return section;
  }

  /**
   * Create data management section
   */
  private async createDataSection(): Promise<HTMLElement> {
    const section = createSafeElement('section', '', 'settings-section');
    const title = createSafeElement('h2', 'Data Management', 'section-title');
    
    // Storage usage
    const usage = await this.createStorageUsage();
    
    // Actions
    const actions = this.createDataActions();
    
    section.appendChild(title);
    section.appendChild(usage);
    section.appendChild(actions);
    
    return section;
  }

  /**
   * Create storage usage display
   */
  private async createStorageUsage(): Promise<HTMLElement> {
    const container = createSafeElement('div', '', 'storage-usage');
    
    try {
      const [roles, bullets, projects] = await Promise.all([
        getAll('roles'),
        getAll('bullets'),
        getAll('projects')
      ]);
      
      const stats = createSafeElement('div', '', 'usage-stats');
      const roleCount = createSafeElement('span', `${roles.length} roles`, 'stat-item');
      const bulletCount = createSafeElement('span', `${bullets.length} bullets`, 'stat-item');
      const projectCount = createSafeElement('span', `${projects.length} projects`, 'stat-item');
      
      stats.appendChild(roleCount);
      stats.appendChild(bulletCount);
      stats.appendChild(projectCount);
      container.appendChild(stats);
      
    } catch (error) {
      const errorMsg = createSafeElement('div', 'Unable to load storage usage', 'error-text');
      container.appendChild(errorMsg);
    }
    
    return container;
  }

  /**
   * Create data action buttons
   */
  private createDataActions(): HTMLElement {
    const actions = createSafeElement('div', '', 'data-actions');
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'form-button form-button--secondary';
    setSafeTextContent(exportBtn, 'Export Data');
    exportBtn.addEventListener('click', () => this.exportData());
    
    const importBtn = document.createElement('button');
    importBtn.className = 'form-button form-button--secondary';
    setSafeTextContent(importBtn, 'Import Data');
    importBtn.addEventListener('click', () => this.importData());
    
    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    
    return actions;
  }

  // ============================================================================
  // Data Operations
  // ============================================================================

  /**
   * Export all data
   */
  private async exportData(): Promise<void> {
    try {
      const [roles, projects, bullets] = await Promise.all([
        getAll('roles'),
        getAll('projects'), 
        getAll('bullets')
      ]);
      
      const exportData = {
        version: 1,
        timestamp: Date.now(),
        data: { roles, projects, bullets }
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `resuum-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import data
   */
  private importData(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.version || !importData.data) {
          throw new Error('Invalid file format');
        }
        
        alert('Import functionality coming soon');
        
      } catch (error) {
        alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    
    input.click();
  }
}