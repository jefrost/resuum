/**
 * Main Application UI
 * Coordinates the three-tab interface and application state
 */

import { 
    createSafeElement, 
    createErrorElement,
    createSuccessElement 
  } from './xss-safe-rendering';
import { ApplicationTab } from './application-tab';
import { SettingsTab } from './settings-tab';
  
  // ============================================================================
  // Application State Types
  // ============================================================================
  
  export type TabName = 'application' | 'experience' | 'settings';
  
  export interface AppState {
    currentTab: TabName;
    loading: boolean;
    error?: string | undefined;
    success?: string | undefined;
  }
  
  export interface TabConfig {
    id: TabName;
    label: string;
    icon: string;
    description: string;
  }
  
  // ============================================================================
  // Tab Configuration
  // ============================================================================
  
  const TAB_CONFIGS: TabConfig[] = [
    {
      id: 'application',
      label: 'New Application',
      icon: '📝',
      description: 'Generate recommendations for a job application'
    },
    {
      id: 'experience',
      label: 'Experience',
      icon: '💼',
      description: 'Manage your bullet points and projects'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure API key and data management'
    }
  ];
  
  // ============================================================================
  // Main Application Class
  // ============================================================================
  
  export class ResuumApp {
    private state: AppState = {
      currentTab: 'application',
      loading: false
    };
    
    private container: HTMLElement;
    private tabNavigation: HTMLElement | null = null;
    private tabContent: HTMLElement | null = null;
    private statusBar: HTMLElement | null = null;
    
    // Tab instances
    private applicationTab: ApplicationTab | null = null;
    private settingsTab: SettingsTab | null = null;
    
    constructor(containerId: string) {
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container element with id "${containerId}" not found`);
      }
      this.container = container;
    }
    
    // ============================================================================
    // Initialization
    // ============================================================================
    
    /**
     * Initialize the application UI
     */
    async initialize(): Promise<void> {
      try {
        this.showLoading('Initializing Resuum...');
        
        // Clear container and build UI structure
        this.container.innerHTML = '';
        this.buildUIStructure();
        
        // Initialize with default tab
        await this.switchTab('application');
        
        this.hideLoading();
        this.showSuccess('Resuum initialized successfully');
        
      } catch (error) {
        this.showError(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    /**
     * Build the main UI structure
     */
    private buildUIStructure(): void {
        // Clear the app container
        this.container.innerHTML = '';
        
        // Find the sidebar navigation container
        const sidebarNav = document.getElementById('sidebar-nav');
        if (sidebarNav) {
        // Create navigation in sidebar
        const navigation = this.createTabNavigation();
        sidebarNav.appendChild(navigation);
        this.tabNavigation = navigation;
        }
        
        // Create main content area
        const content = this.createTabContent();
        const status = this.createStatusBar();
        
        this.container.appendChild(content);
        this.container.appendChild(status);
        
        // Store references
        this.tabContent = content;
        this.statusBar = status;
    }
    
    /**
     * Create tab navigation
     */
    private createTabNavigation(): HTMLElement {
      const nav = createSafeElement('nav', '', 'tab-navigation');
      const tabList = createSafeElement('ul', '', 'tab-list');
      
      TAB_CONFIGS.forEach(tabConfig => {
        const tabItem = this.createTabItem(tabConfig);
        tabList.appendChild(tabItem);
      });
      
      nav.appendChild(tabList);
      return nav;
    }
    
    /**
     * Create individual tab item
     */
    private createTabItem(config: TabConfig): HTMLElement {
      const listItem = createSafeElement('li', '', 'tab-item');
      const button = document.createElement('button');
      
      button.className = `tab-button ${this.state.currentTab === config.id ? 'tab-button--active' : ''}`;
      button.setAttribute('data-tab', config.id);
      button.setAttribute('aria-label', config.description);
      
      const icon = createSafeElement('span', config.icon, 'tab-icon');
      const label = createSafeElement('span', config.label, 'tab-label');
      
      button.appendChild(icon);
      button.appendChild(label);
      
      button.addEventListener('click', () => {
        this.switchTab(config.id);
      });
      
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.switchTab(config.id);
        }
      });
      
      listItem.appendChild(button);
      return listItem;
    }
    
    /**
     * Create tab content container
     */
    private createTabContent(): HTMLElement {
      return createSafeElement('div', '', 'tab-content');
    }
    
    /**
     * Create status bar
     */
    private createStatusBar(): HTMLElement {
      return createSafeElement('div', '', 'status-bar');
    }
    
    // ============================================================================
    // Tab Management
    // ============================================================================
    
    /**
     * Switch to a different tab
     */
    private async switchTab(tabName: TabName): Promise<void> {
      try {
        this.state.currentTab = tabName;
        this.updateTabNavigation();
        await this.loadTabContent(tabName);
      } catch (error) {
        this.showError(`Failed to switch to ${tabName} tab: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    /**
     * Update tab navigation visual state
     */
    private updateTabNavigation(): void {
      if (!this.tabNavigation) return;
      
      const buttons = this.tabNavigation.querySelectorAll('.tab-button');
      buttons.forEach(button => {
        const isActive = button.getAttribute('data-tab') === this.state.currentTab;
        button.classList.toggle('tab-button--active', isActive);
        button.setAttribute('aria-selected', isActive.toString());
      });
    }
    
    /**
     * Load content for the current tab
     */
    private async loadTabContent(tabName: TabName): Promise<void> {
      if (!this.tabContent) return;
      
      // Clear existing content
      this.tabContent.innerHTML = '';
      
      // Create tab-specific content
      switch (tabName) {
        case 'application':
          await this.loadApplicationTab();
          break;
        case 'experience':
          this.loadExperienceTab();
          break;
        case 'settings':
          await this.loadSettingsTab();
          break;
        default:
          throw new Error(`Unknown tab: ${tabName}`);
      }
    }
    
    /**
     * Load New Application tab content
     */
    private async loadApplicationTab(): Promise<void> {
      if (!this.tabContent) return;
      
      try {
        // Initialize ApplicationTab if not already done
        if (!this.applicationTab) {
          this.applicationTab = new ApplicationTab(this.tabContent);
        }
        
        // Render the application tab
        this.applicationTab.render();
        
      } catch (error) {
        this.showError(`Failed to load application tab: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    /**
     * Load Experience tab content (placeholder)
     */
/**
 * Load Experience tab content (FIXED VERSION)
 * Replace the existing loadExperienceTab() method in app.ts with this
 */
private async loadExperienceTab(): Promise<void> {
    if (!this.tabContent) return;
    
    console.log('Loading Experience tab...');
    
    try {
      // Clear content first
      this.tabContent.innerHTML = '';
      
      // Import the ExperienceTab class
      const { ExperienceTab } = await import('./experience-tab');
      
      console.log('ExperienceTab imported successfully');
      console.log('Creating ExperienceTab instance...');
      
      const experienceTab = new ExperienceTab(this.tabContent);
      
      console.log('Rendering ExperienceTab...');
      await experienceTab.render();
      
      console.log('ExperienceTab rendered successfully');
      
    } catch (error) {
      console.error('Experience tab error:', error);
      
      if (this.tabContent) {
        this.tabContent.innerHTML = `
          <div style="color: red; padding: 1rem; border: 1px solid #ff0000; border-radius: 4px; margin: 1rem;">
            <h3>Experience Tab Error</h3>
            <p>Failed to load Experience tab: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <details>
              <summary>Click for Error Details</summary>
              <pre style="background: #f5f5f5; padding: 1rem; margin-top: 0.5rem; overflow: auto;">${error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}</pre>
            </details>
            <br>
            <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Reload Page
            </button>
          </div>
        `;
      }
    }
  }
    
    /**
     * Load Settings tab content
     */
    private async loadSettingsTab(): Promise<void> {
      if (!this.tabContent) return;
      
      try {
        // Initialize SettingsTab if not already done
        if (!this.settingsTab) {
          this.settingsTab = new SettingsTab(this.tabContent);
        }
        
        // Render the settings tab
        await this.settingsTab.render();
        
      } catch (error) {
        this.showError(`Failed to load settings tab: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // ============================================================================
    // State Management
    // ============================================================================
    
    /**
     * Show loading state
     */
    private showLoading(message: string): void {
      this.state.loading = true;
      this.state.error = undefined;
      this.state.success = undefined;
      this.updateStatusBar(message, 'loading');
    }
    
    /**
     * Hide loading state
     */
    private hideLoading(): void {
      this.state.loading = false;
      this.updateStatusBar('', 'hidden');
    }
    
    /**
     * Show error message
     */
    private showError(message: string): void {
      this.state.loading = false;
      this.state.error = message;
      this.state.success = undefined;
      this.updateStatusBar(message, 'error');
    }
    
    /**
     * Show success message
     */
    private showSuccess(message: string): void {
      this.state.loading = false;
      this.state.error = undefined;
      this.state.success = message;
      this.updateStatusBar(message, 'success');
      
      // Auto-hide success messages after 3 seconds
      setTimeout(() => {
        if (this.state.success === message) {
          this.hideLoading();
        }
      }, 3000);
    }
    
    /**
     * Update status bar
     */
    private updateStatusBar(message: string, type: 'loading' | 'error' | 'success' | 'hidden'): void {
      if (!this.statusBar) return;
      
      this.statusBar.innerHTML = '';
      this.statusBar.className = `status-bar status-bar--${type}`;
      
      if (type !== 'hidden' && message) {
        let element: HTMLElement;
        
        switch (type) {
          case 'loading':
            element = createSafeElement('div', `⏳ ${message}`, 'status-message');
            break;
          case 'error':
            element = createErrorElement(message);
            break;
          case 'success':
            element = createSuccessElement(`✓ ${message}`);
            break;
          default:
            element = createSafeElement('div', message, 'status-message');
        }
        
        this.statusBar.appendChild(element);
      }
    }
    
    // ============================================================================
    // Public API
    // ============================================================================
    
    /**
     * Get current application state
     */
    getState(): Readonly<AppState> {
      return { ...this.state };
    }
    
    /**
     * Navigate to specific tab programmatically
     */
    async navigateToTab(tabName: TabName): Promise<void> {
      await this.switchTab(tabName);
    }
  }