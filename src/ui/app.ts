/**
 * Main Application UI
 * Coordinates the three-tab interface and application state
 */

import { 
    createSafeElement, 
    setSafeTextContent, 
    createErrorElement,
    createSuccessElement 
  } from './xss-safe-rendering';
  
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
      
      // Create button content safely
      const icon = createSafeElement('span', config.icon, 'tab-icon');
      const label = createSafeElement('span', config.label, 'tab-label');
      
      button.appendChild(icon);
      button.appendChild(label);
      
      // Add click handler
      button.addEventListener('click', () => {
        this.switchTab(config.id);
      });
      
      // Add keyboard navigation
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
    async switchTab(tabName: TabName): Promise<void> {
      try {
        // Update state
        this.state.currentTab = tabName;
        
        // Update navigation visual state
        this.updateTabNavigation();
        
        // Load tab content
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
          this.loadApplicationTab();
          break;
        case 'experience':
          this.loadExperienceTab();
          break;
        case 'settings':
          this.loadSettingsTab();
          break;
        default:
          throw new Error(`Unknown tab: ${tabName}`);
      }
    }
    
    /**
     * Load New Application tab content
     */
    private loadApplicationTab(): void {
      if (!this.tabContent) return;
      
      const container = createSafeElement('div', '', 'application-tab');
      
      // Create job input section
      const jobSection = createSafeElement('section', '', 'job-input-section');
      const jobTitle = createSafeElement('h2', 'Job Application', 'section-title');
      const jobForm = this.createJobInputForm();
      
      jobSection.appendChild(jobTitle);
      jobSection.appendChild(jobForm);
      
      // Create results section (initially hidden)
      const resultsSection = createSafeElement('section', '', 'results-section hidden');
      const resultsTitle = createSafeElement('h2', 'Recommendations', 'section-title');
      const resultsContainer = createSafeElement('div', '', 'results-container');
      
      resultsSection.appendChild(resultsTitle);
      resultsSection.appendChild(resultsContainer);
      
      container.appendChild(jobSection);
      container.appendChild(resultsSection);
      this.tabContent.appendChild(container);
    }
    
    /**
     * Create job input form
     */
    private createJobInputForm(): HTMLElement {
      const form = createSafeElement('form', '', 'job-input-form');
      
      // Job title input
      const titleGroup = createSafeElement('div', '', 'form-group');
      const titleLabel = createSafeElement('label', 'Job Title', 'form-label');
      titleLabel.setAttribute('for', 'job-title');
      
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.id = 'job-title';
      titleInput.className = 'form-input';
      titleInput.placeholder = 'e.g., Senior Product Manager';
      
      titleGroup.appendChild(titleLabel);
      titleGroup.appendChild(titleInput);
      
      // Job description textarea
      const descGroup = createSafeElement('div', '', 'form-group');
      const descLabel = createSafeElement('label', 'Job Description', 'form-label');
      descLabel.setAttribute('for', 'job-description');
      
      const descTextarea = document.createElement('textarea');
      descTextarea.id = 'job-description';
      descTextarea.className = 'form-textarea';
      descTextarea.placeholder = 'Paste the job description here...';
      descTextarea.rows = 8;
      
      descGroup.appendChild(descLabel);
      descGroup.appendChild(descTextarea);
      
      // Function bias selection
      const biasGroup = createSafeElement('div', '', 'form-group');
      const biasLabel = createSafeElement('label', 'Function Bias', 'form-label');
      biasLabel.setAttribute('for', 'function-bias');
      
      const biasSelect = document.createElement('select');
      biasSelect.id = 'function-bias';
      biasSelect.className = 'form-select';
      
      const biasOptions = [
        { value: 'general', label: 'General' },
        { value: 'technical', label: 'Technical' },
        { value: 'business_strategy', label: 'Business Strategy' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'operations', label: 'Operations' }
      ];
      
      biasOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        setSafeTextContent(optionElement, option.label);
        biasSelect.appendChild(optionElement);
      });
      
      biasGroup.appendChild(biasLabel);
      biasGroup.appendChild(biasSelect);
      
      // Submit button
      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.className = 'form-submit';
      setSafeTextContent(submitButton, 'Generate Recommendations');
      
      // Form submission handler
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.handleJobSubmission(titleInput.value, descTextarea.value, biasSelect.value);
      });
      
      form.appendChild(titleGroup);
      form.appendChild(descGroup);
      form.appendChild(biasGroup);
      form.appendChild(submitButton);
      
      return form;
    }
    
    /**
     * Load Experience tab content
     */
    private loadExperienceTab(): void {
        if (!this.tabContent) return;
        
        console.log('Loading Experience tab...');
        
        try {
        // Import and instantiate the ExperienceTab
        import('./experience-tab').then(({ ExperienceTab }) => {
            if (this.tabContent) {
            console.log('Creating ExperienceTab instance...');
            const experienceTab = new ExperienceTab(this.tabContent);
            experienceTab.render();
            console.log('ExperienceTab rendered successfully');
            }
        }).catch(error => {
            console.error('Dynamic import failed:', error);
            if (this.tabContent) {
            this.tabContent.innerHTML = `<div style="color: red; padding: 1rem;">
                Failed to load Experience tab: ${error.message}
            </div>`;
            }
        });
        } catch (error) {
        console.error('Experience tab error:', error);
        if (this.tabContent) {
            this.tabContent.innerHTML = `<div style="color: red; padding: 1rem;">
            Experience tab error: ${error instanceof Error ? error.message : 'Unknown error'}
            </div>`;
        }
        }
    }

    /**
     * Load Settings tab content  
     */
    private loadSettingsTab(): void {
        if (!this.tabContent) return;
        
        const container = createSafeElement('div', '', 'settings-tab');
        const placeholder = createSafeElement('div', 'Settings configuration coming soon...', 'tab-placeholder');
        
        container.appendChild(placeholder);
        this.tabContent.appendChild(container);
    }
    
    // ============================================================================
    // Event Handlers
    // ============================================================================
    
    /**
     * Handle job submission
     */
    private async handleJobSubmission(title: string, description: string, bias: string): Promise<void> {
      try {
        this.showLoading('Generating recommendations...');
        
        // TODO: Integrate with worker communication
        // For now, just show a placeholder result
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.showSuccess('Recommendations generated successfully!');
        
      } catch (error) {
        this.showError(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
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