/**
 * New Application Tab UI
 * Handles job description input and recommendation display
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { RecommendationEngine } from '../workers/recommendation-engine';
import type { RecommendationResult, BulletResult as WorkerBulletResult } from '../types';

// ============================================================================
// Service Layer Bridge
// ============================================================================

class RecommendationService {
  private engine: RecommendationEngine;

  constructor() {
    this.engine = new RecommendationEngine();
  }

  async generateRecommendations(jobTitle: string, jobDescription: string): Promise<RecommendationResult> {
    return await this.engine.generateRecommendations(jobTitle, jobDescription);
  }
}

// Global service instance
let recommendationService: RecommendationService | null = null;

function getRecommendationService(): RecommendationService {
  if (!recommendationService) {
    recommendationService = new RecommendationService();
  }
  return recommendationService;
}

// ============================================================================
// UI-specific Types
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
  private processingState: 'idle' | 'processing' | 'almost-done' | 'complete' | 'error' = 'idle';
  private lastResults: GenerationResult | null = null;
  private lastError: string | null = null;
  private lastJobData: { title: string; description: string } | null = null;
  private onStatusUpdate: ((status: { error?: string; success?: string }) => void) | undefined;

  constructor(
    container: HTMLElement, 
    onStatusUpdate?: (status: { error?: string; success?: string }) => void
  ) {
    this.container = container;
    this.onStatusUpdate = onStatusUpdate;
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
    submitButton.disabled = this.processingState === 'processing' || this.processingState === 'almost-done';
    setSafeTextContent(submitButton, this.getSubmitButtonText());
    
    form.appendChild(titleGroup);
    form.appendChild(descriptionGroup);
    form.appendChild(submitButton);
    
    // Add form submission handler
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      // Type guard for form element
      if (event.target && this.isHTMLFormElement(event.target)) {
        this.handleFormSubmission(event.target);
      }
    });
    
    return form;
  }

  /**
   * Type guard for HTMLFormElement
   */
  private isHTMLFormElement(element: EventTarget): element is HTMLFormElement {
    return element instanceof HTMLFormElement;
  }

  /**
   * Get submit button text based on processing state
   */
  private getSubmitButtonText(): string {
    switch (this.processingState) {
      case 'processing':
        return 'Processing...';
      case 'almost-done':
        return 'Almost done...';
      default:
        return 'Generate Recommendations';
    }
  }

  /**
   * Handle form submission
   */
  private async handleFormSubmission(form: HTMLFormElement): Promise<void> {
    // Get form data
    const formData = new FormData(form);
    const jobTitle = (formData.get('job-title') as string | null)?.trim() || '';
    const jobDescription = (formData.get('job-description') as string | null)?.trim() || '';

    // Basic validation
    if (!jobTitle) {
      this.showInlineError('Please enter a job title');
      return;
    }

    if (!jobDescription || jobDescription.length < 10) {
      this.showInlineError('Please enter a job description (at least 10 characters)');
      return;
    }

    // Clear previous errors
    this.lastError = null;
    
    // Store job data
    this.lastJobData = { title: jobTitle, description: jobDescription };

    try {
      // Start processing
      this.updateProcessingState('processing');
      this.render(); // Re-render to show processing state

      const service = getRecommendationService();
      
      // Simulate progression for better UX
      setTimeout(() => {
        if (this.processingState === 'processing') {
          this.updateProcessingState('almost-done');
          this.render();
        }
      }, 1500);

      // Generate recommendations
      const result = await service.generateRecommendations(jobTitle, jobDescription);
      
      // Convert to our display format
      this.lastResults = {
        jobTitle: result.jobTitle,
        totalBullets: result.totalBullets,
        processingTime: result.processingTime,
        projectsConsidered: result.roleResults.length, // Approximation for now
        roleResults: result.roleResults.map(role => ({
          roleTitle: role.roleTitle,
          projectsShortlisted: [], // Will be populated in future iterations
          selectedBullets: role.selectedBullets.map((bullet: WorkerBulletResult) => ({
            text: bullet.text,
            relevance: bullet.relevanceScore ?? 0.9,
            projectName: bullet.projectName ?? 'Unknown Project'
          })),
          avgRelevance: role.selectedBullets.reduce((avg, b) => avg + (b.relevanceScore ?? 0.9), 0) / role.selectedBullets.length
        }))
      };

      this.updateProcessingState('complete');
      if (this.onStatusUpdate) {
        this.onStatusUpdate({ success: `Generated ${result.totalBullets} recommendations in ${result.processingTime.toFixed(1)}s` });
      }

    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error occurred';
      this.updateProcessingState('error');
      
      // Show error in status bar for critical errors (API key, network)
      if (this.lastError.includes('API key') || this.lastError.includes('network') || this.lastError.includes('OpenAI')) {
        if (this.onStatusUpdate) {
          this.onStatusUpdate({ error: this.lastError });
        }
      }
    }

    // Re-render to show results or error
    this.render();
  }

  /**
   * Update processing state
   */
  private updateProcessingState(state: typeof this.processingState): void {
    this.processingState = state;
  }

  /**
   * Show inline error message
   */
  private showInlineError(message: string): void {
    this.lastError = message;
    this.processingState = 'error';
    this.render();
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
    input.name = id;
    input.className = 'form-input';
    input.placeholder = placeholder;
    
    // Pre-fill with last values if available
    if (this.lastJobData) {
      if (id === 'job-title') {
        input.value = this.lastJobData.title;
      }
    }
    
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
    textarea.name = id;
    textarea.className = 'form-textarea';
    textarea.placeholder = placeholder;
    textarea.rows = 8;
    
    // Pre-fill with last values if available
    if (this.lastJobData && id === 'job-description') {
      textarea.value = this.lastJobData.description;
    }
    
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
    
    if (this.processingState === 'processing' || this.processingState === 'almost-done') {
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
    const statusText = this.processingState === 'processing' 
      ? 'Analyzing job description and finding best matches...'
      : 'Finalizing recommendations...';
    const status = createSafeElement('p', statusText, 'status-text');
    
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
      `Selected ${totalBullets} bullet points across ${projectsConsidered} projects. Processing time: ${processingTime.toFixed(1)}s`
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
    
    for (const roleResult of this.lastResults.roleResults) {
      const roleSection = this.createRoleResultSection(roleResult);
      details.appendChild(roleSection);
    }
    
    return details;
  }

  /**
   * Create role result section
   */
  private createRoleResultSection(roleResult: RoleResult): HTMLElement {
    const section = createSafeElement('div', '', 'role-result');
    
    const header = createSafeElement('h4', '', 'role-title');
    setSafeTextContent(header, 
      `${roleResult.roleTitle} - ${roleResult.selectedBullets.length} bullet points selected`
    );
    
    const bulletsList = createSafeElement('ul', '', 'bullets-list');
    
    for (const bullet of roleResult.selectedBullets) {
      const listItem = createSafeElement('li', '', 'bullet-item');
      const bulletText = createSafeElement('span', bullet.text, 'bullet-text');
      const metadata = createSafeElement('span', '', 'bullet-metadata');
      setSafeTextContent(metadata, 
        ` (Relevance: ${(bullet.relevance * 100).toFixed(0)}%, Project: ${bullet.projectName})`
      );
      
      listItem.appendChild(bulletText);
      listItem.appendChild(metadata);
      bulletsList.appendChild(listItem);
    }
    
    section.appendChild(header);
    section.appendChild(bulletsList);
    
    return section;
  }

  /**
   * Create results actions (copy, export, etc.)
   */
  private createResultsActions(): HTMLElement {
    const actions = createSafeElement('div', '', 'results-actions');
    
    const copyButton = document.createElement('button');
    copyButton.className = 'form-button form-button--primary';
    setSafeTextContent(copyButton, 'Copy All Bullets');
    copyButton.addEventListener('click', () => this.copyBulletsToClipboard());
    
    const regenerateButton = document.createElement('button');
    regenerateButton.className = 'form-button form-button--secondary';
    setSafeTextContent(regenerateButton, 'Regenerate');
    regenerateButton.addEventListener('click', () => this.regenerateRecommendations());
    
    actions.appendChild(copyButton);
    actions.appendChild(regenerateButton);
    
    return actions;
  }

  /**
   * Create error display
   */
  private createErrorDisplay(): HTMLElement {
    const container = createSafeElement('div', '', 'error-display');
    
    const title = createSafeElement('h4', 'Error Generating Recommendations', 'error-title');
    const message = createSafeElement('p', this.lastError || 'Unknown error', 'error-message');
    
    const retryButton = document.createElement('button');
    retryButton.className = 'form-button form-button--secondary';
    setSafeTextContent(retryButton, 'Try Again');
    retryButton.addEventListener('click', () => {
      if (this.lastJobData) {
        // Find form and simulate submission with type safety
        const form = this.container.querySelector('form[data-form="job-input"]');
        if (form && this.isHTMLFormElement(form)) {
          this.handleFormSubmission(form);
        }
      }
    });
    
    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(retryButton);
    
    return container;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Copy bullets to clipboard (simple format)
   */
  private async copyBulletsToClipboard(): Promise<void> {
    if (!this.lastResults) return;
    
    const bullets: string[] = [];
    
    for (const roleResult of this.lastResults.roleResults) {
      for (const bullet of roleResult.selectedBullets) {
        bullets.push(`• ${bullet.text}`);
      }
    }
    
    const text = bullets.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      if (this.onStatusUpdate) {
        this.onStatusUpdate({ success: `Copied ${bullets.length} bullet points to clipboard` });
      }
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (this.onStatusUpdate) {
        this.onStatusUpdate({ success: `Copied ${bullets.length} bullet points to clipboard` });
      }
    }
  }

  /**
   * Regenerate recommendations
   */
  private regenerateRecommendations(): void {
    if (this.lastJobData) {
      const form = this.container.querySelector('form[data-form="job-input"]');
      if (form && this.isHTMLFormElement(form)) {
        this.handleFormSubmission(form);
      }
    }
  }

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  /**
   * Add keyboard shortcuts
   */
  private addKeyboardShortcuts(): void {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit form
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        const form = this.container.querySelector('form[data-form="job-input"]');
        if (form && this.isHTMLFormElement(form) && this.processingState === 'idle') {
          this.handleFormSubmission(form);
        }
      }
      
      // Ctrl/Cmd + C to copy results (when results are visible)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && this.lastResults) {
        const activeElement = document.activeElement;
        // Only trigger if not typing in an input
        if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
          event.preventDefault();
          this.copyBulletsToClipboard();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
  }
}