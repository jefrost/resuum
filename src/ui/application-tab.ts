/**
 * New Application Tab UI
 * Handles job description input and recommendation display
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getSampleDataset } from '../data/sample-data';

// ============================================================================
// Types
// ============================================================================

interface GenerationResult {
  jobTitle: string;
  totalBullets: number;
  processingTime: number;
  projectsConsidered: number;
  roleResults: RoleResult[];
}

interface RoleResult {
  roleTitle: string;
  projectsShortlisted: string[];
  selectedBullets: BulletResult[];
  avgRelevance: number;
}

interface BulletResult {
  text: string;
  relevance: number;
  projectName: string;
}

// ============================================================================
// Application Tab Class
// ============================================================================

export class ApplicationTab {
  private container: HTMLElement;
  private processingState: 'idle' | 'processing' | 'complete' | 'error' = 'idle';
  private lastResults: GenerationResult | null = null;
  private lastError: string | null = null;
  private lastJobData: { title: string; description: string } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  // ============================================================================
  // Public Interface
  // ============================================================================

  /**
   * Render the Application tab content
   */
  render(): void {
    this.container.innerHTML = '';
    
    const tabContainer = createSafeElement('div', '', 'application-tab');
    
    // Create job input section
    const inputSection = this.createJobInputSection();
    tabContainer.appendChild(inputSection);
    
    // Create results section (if we have results)
    if (this.lastResults || this.processingState !== 'idle') {
      const resultsSection = this.createResultsSection();
      tabContainer.appendChild(resultsSection);
    }
    
    this.container.appendChild(tabContainer);
    
    // Add keyboard shortcuts
    this.addKeyboardShortcuts();
  }

  // ============================================================================
  // Job Input Section
  // ============================================================================

  /**
   * Create job input form section
   */
  private createJobInputSection(): HTMLElement {
    const section = createSafeElement('section', '', 'job-input-section');
    
    const title = createSafeElement('h2', 'New Job Application', 'section-title');
    const description = createSafeElement('p', 
      'Paste your job description below and get AI-powered resume recommendations.', 
      'section-description'
    );
    
    const form = this.createJobInputForm();
    
    section.appendChild(title);
    section.appendChild(description);
    section.appendChild(form);
    
    return section;
  }

  /**
   * Create job input form
   */
  private createJobInputForm(): HTMLElement {
    const form = createSafeElement('form', '', 'job-input-form');
    form.setAttribute('data-form', 'job-input');
    
    // Job title input
    const titleGroup = this.createInputGroup(
      'job-title', 
      'Job Title', 
      'text', 
      'e.g., Senior Product Manager'
    );
    
    // Job description textarea
    const descriptionGroup = this.createTextareaGroup(
      'job-description',
      'Job Description',
      'Paste the complete job description here...'
    );
    
    // Submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'form-submit';
    submitButton.disabled = this.processingState === 'processing';
    setSafeTextContent(submitButton, 
      this.processingState === 'processing' ? 'Generating...' : 'Generate Recommendations'
    );
    
    form.appendChild(titleGroup);
    form.appendChild(descriptionGroup);
    form.appendChild(submitButton);
    
    // Add form submission handler
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleFormSubmission(form);
    });
    
    return form;
  }

  /**
   * Create input group
   */
  private createInputGroup(id: string, label: string, type: string, placeholder: string): HTMLElement {
    const group = createSafeElement('div', '', 'input-group');
    
    const labelElement = createSafeElement('label', label, 'input-label');
    labelElement.setAttribute('for', id);
    
    const input = document.createElement('input') as HTMLInputElement;
    input.type = type;
    input.id = id;
    input.className = 'form-input';
    input.placeholder = placeholder;
    
    group.appendChild(labelElement);
    group.appendChild(input);
    
    return group;
  }

  /**
   * Create textarea group
   */
  private createTextareaGroup(id: string, label: string, placeholder: string): HTMLElement {
    const group = createSafeElement('div', '', 'input-group');
    
    const labelElement = createSafeElement('label', label, 'input-label');
    labelElement.setAttribute('for', id);
    
    const textarea = document.createElement('textarea') as HTMLTextAreaElement;
    textarea.id = id;
    textarea.className = 'form-textarea';
    textarea.placeholder = placeholder;
    textarea.rows = 8;
    
    group.appendChild(labelElement);
    group.appendChild(textarea);
    
    return group;
  }

  // ============================================================================
  // Results Section
  // ============================================================================

  /**
   * Create results display section
   */
  private createResultsSection(): HTMLElement {
    const section = createSafeElement('section', '', 'results-section');
    
    const title = createSafeElement('h3', 'Recommendations', 'results-title');
    section.appendChild(title);
    
    if (this.processingState === 'processing') {
      const status = this.createProcessingStatus();
      section.appendChild(status);
    } else if (this.processingState === 'complete' && this.lastResults) {
      const summary = this.createResultsSummary();
      const details = this.createResultsDetails();
      const actions = this.createResultsActions();
      
      section.appendChild(summary);
      section.appendChild(details);
      section.appendChild(actions);
    } else if (this.processingState === 'error') {
      const error = this.createErrorDisplay();
      section.appendChild(error);
    }
    
    return section;
  }

  /**
   * Create processing status display
   */
  private createProcessingStatus(): HTMLElement {
    const container = createSafeElement('div', '', 'processing-status');
    
    const spinner = createSafeElement('div', '', 'spinner');
    const status = createSafeElement('p', 'Analyzing job description and finding best matches...', 'status-text');
    
    container.appendChild(spinner);
    container.appendChild(status);
    
    return container;
  }

  /**
   * Create results summary box
   */
  private createResultsSummary(): HTMLElement {
    if (!this.lastResults) return createSafeElement('div', '', 'results-summary');
    
    const summary = createSafeElement('div', '', 'results-summary');
    
    const { totalBullets, processingTime, projectsConsidered } = this.lastResults;
    
    const summaryText = createSafeElement('p', '', 'summary-text');
    setSafeTextContent(summaryText, 
      `Selected ${totalBullets} bullet points across ${projectsConsidered} projects. Processing time: ${processingTime}s`
    );
    
    summary.appendChild(summaryText);
    return summary;
  }

  /**
   * Create detailed results display
   */
  private createResultsDetails(): HTMLElement {
    if (!this.lastResults) return createSafeElement('div', '', 'results-details');
    
    const details = createSafeElement('div', '', 'results-details');
    
    this.lastResults.roleResults.forEach((roleResult: RoleResult) => {
      const roleSection = this.createRoleResultSection(roleResult);
      details.appendChild(roleSection);
    });
    
    return details;
  }

  /**
   * Create individual role result section
   */
  private createRoleResultSection(roleResult: RoleResult): HTMLElement {
    const section = createSafeElement('div', '', 'role-result-section');
    
    // Role header
    const header = createSafeElement('div', '', 'role-header');
    const title = createSafeElement('h4', '', 'role-title');
    setSafeTextContent(title, `${roleResult.roleTitle} - ${roleResult.selectedBullets.length} bullet points selected`);
    
    const projectsInfo = createSafeElement('p', '', 'projects-info');
    setSafeTextContent(projectsInfo, `Projects considered: ${roleResult.projectsShortlisted.join(', ')}`);
    
    header.appendChild(title);
    header.appendChild(projectsInfo);
    
    // Bullet points list
    const bulletsList = createSafeElement('ul', '', 'bullets-list');
    
    // Sort bullets by relevance for deterministic output
    const sortedBullets = [...roleResult.selectedBullets].sort((a, b) => b.relevance - a.relevance);
    
    sortedBullets.forEach((bullet: BulletResult) => {
      const listItem = createSafeElement('li', '', 'bullet-item');
      
      const bulletText = createSafeElement('span', bullet.text, 'bullet-text');
      const metadata = createSafeElement('span', '', 'bullet-metadata');
      setSafeTextContent(metadata, `(Relevance: ${Math.round(bullet.relevance * 100)}%, Project: ${bullet.projectName})`);
      
      listItem.appendChild(bulletText);
      listItem.appendChild(metadata);
      bulletsList.appendChild(listItem);
    });
    
    section.appendChild(header);
    section.appendChild(bulletsList);
    
    return section;
  }

  /**
   * Create results actions section
   */
  private createResultsActions(): HTMLElement {
    const actions = createSafeElement('div', '', 'results-actions');
    
    const copyButton = document.createElement('button');
    copyButton.className = 'action-button action-button--primary';
    setSafeTextContent(copyButton, 'Copy All Bullets');
    copyButton.addEventListener('click', () => this.copyResultsToClipboard());
    
    const exportButton = document.createElement('button');
    exportButton.className = 'action-button action-button--secondary';
    setSafeTextContent(exportButton, 'Export to Plain Text');
    exportButton.addEventListener('click', () => this.exportResultsToText());
    
    const refreshButton = document.createElement('button');
    refreshButton.className = 'action-button action-button--tertiary';
    setSafeTextContent(refreshButton, 'Refresh Results');
    refreshButton.addEventListener('click', () => this.refreshResults());
    
    actions.appendChild(copyButton);
    actions.appendChild(exportButton);
    actions.appendChild(refreshButton);
    
    return actions;
  }

  /**
   * Create error display
   */
  private createErrorDisplay(): HTMLElement {
    const container = createSafeElement('div', '', 'error-display');
    
    const title = createSafeElement('h4', 'Generation Failed', 'error-title');
    const message = createSafeElement('p', this.lastError || 'Unknown error occurred', 'error-message');
    
    const retryButton = document.createElement('button');
    retryButton.className = 'action-button action-button--primary';
    setSafeTextContent(retryButton, 'Try Again');
    retryButton.addEventListener('click', () => this.retryGeneration());
    
    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(retryButton);
    
    return container;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle form submission
   */
  private async handleFormSubmission(form: HTMLElement): Promise<void> {
    try {
      const formData = new FormData(form as HTMLFormElement);
      const jobTitle = formData.get('job-title') as string;
      const jobDescription = formData.get('job-description') as string;
      
      if (!jobDescription?.trim()) {
        throw new Error('Job description is required');
      }
      
      await this.generateRecommendations(jobTitle, jobDescription);
      
    } catch (error) {
      this.processingState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.render();
    }
  }

  /**
   * Generate recommendations (placeholder for now)
   */
  private async generateRecommendations(jobTitle: string, jobDescription: string): Promise<void> {
    this.processingState = 'processing';
    this.lastError = null;
    this.lastJobData = { title: jobTitle, description: jobDescription };
    this.render();
    
    try {
      // TODO: Implement actual AI-powered recommendation generation
      const startTime = Date.now();
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock result for now
      const result = await this.simulateRecommendationGeneration(jobTitle, jobDescription);
      
      const processingTime = (Date.now() - startTime) / 1000;
      result.processingTime = processingTime;
      
      this.lastResults = result;
      this.processingState = 'complete';
      this.render();
      
    } catch (error) {
      this.processingState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.render();
    }
  }

  /**
   * Simulate recommendation generation (temporary)
   */
  private async simulateRecommendationGeneration(jobTitle: string, jobDescription: string): Promise<GenerationResult> {
    return {
      jobTitle,
      totalBullets: 5,
      processingTime: 2.1,
      projectsConsidered: 8,
      roleResults: [
        {
          roleTitle: 'Senior Consultant',
          projectsShortlisted: ['Global Telecom', 'Healthcare M&A', 'Retail Strategy'],
          selectedBullets: [
            {
              text: 'Led cross-functional team of 12 engineers to deliver enterprise software platform, resulting in 40% improvement in deployment efficiency',
              relevance: 0.94,
              projectName: 'Global Telecom'
            },
            {
              text: 'Developed comprehensive market analysis framework, identifying $50M growth opportunity in emerging markets',
              relevance: 0.89,
              projectName: 'Healthcare M&A'
            }
          ],
          avgRelevance: 0.90
        }
      ]
    };
  }

  /**
   * Copy results to clipboard
   */
  private async copyResultsToClipboard(): Promise<void> {
    // TODO: Implement clipboard functionality
    console.log('Copy to clipboard not implemented yet');
  }

  /**
   * Export results to text
   */
  private exportResultsToText(): void {
    // TODO: Implement export functionality
    console.log('Export to text not implemented yet');
  }

  /**
   * Refresh results
   */
  private refreshResults(): void {
    if (this.lastJobData) {
      this.generateRecommendations(this.lastJobData.title, this.lastJobData.description);
    }
  }

  /**
   * Retry generation
   */
  private retryGeneration(): void {
    if (this.lastJobData) {
      this.generateRecommendations(this.lastJobData.title, this.lastJobData.description);
    }
  }

  /**
   * Add keyboard shortcuts
   */
  private addKeyboardShortcuts(): void {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        const form = this.container.querySelector('.job-input-form') as HTMLFormElement;
        if (form && this.processingState !== 'processing') {
          this.handleFormSubmission(form);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
  }
}