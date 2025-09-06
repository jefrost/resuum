/**
 * New Application Tab UI
 * Handles job description input and recommendation display
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getSampleDataset } from '../data/sample-data';

// ============================================================================
// Application Tab Class
// ============================================================================

export class ApplicationTab {
  private container: HTMLElement;
  private processingState: 'idle' | 'processing' | 'complete' | 'error' = 'idle';
  private lastResults: any = null;

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
    if (this.lastResults) {
      const resultsSection = this.createResultsSection();
      tabContainer.appendChild(resultsSection);
    }
    
    this.container.appendChild(tabContainer);
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
    
    // Job title input
    const titleGroup = this.createInputGroup('job-title', 'Job Title', 'text', 'e.g., Senior Software Engineer');
    
    // Job description textarea
    const descGroup = this.createTextareaGroup(
      'job-description', 
      'Job Description', 
      'Paste the complete job description here...'
    );
    
    // Function bias selector
    const biasGroup = this.createSelectGroup('function-bias', 'Function Bias', [
      { value: 'general', label: 'General' },
      { value: 'technical', label: 'Technical' },
      { value: 'business_strategy', label: 'Business Strategy' },
      { value: 'marketing', label: 'Marketing/PMM' },
      { value: 'operations', label: 'Operations' }
    ]);
    
    // Submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'generate-button';
    setSafeTextContent(submitButton, 
      this.processingState === 'processing' ? 'Generating...' : 'Generate Recommendations'
    );
    submitButton.disabled = this.processingState === 'processing';
    
    submitButton.addEventListener('click', () => {
      this.handleSubmission();
    });
    
    form.appendChild(titleGroup);
    form.appendChild(descGroup);
    form.appendChild(biasGroup);
    form.appendChild(submitButton);
    
    return form;
  }

  /**
   * Create input group with label
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
   * Create textarea group with label
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

  /**
   * Create select group with options
   */
  private createSelectGroup(id: string, label: string, options: Array<{value: string; label: string}>): HTMLElement {
    const group = createSafeElement('div', '', 'input-group');
    
    const labelElement = createSafeElement('label', label, 'input-label');
    labelElement.setAttribute('for', id);
    
    const select = document.createElement('select') as HTMLSelectElement;
    select.id = id;
    select.className = 'form-select';
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      setSafeTextContent(optionElement, option.label);
      select.appendChild(optionElement);
    });
    
    group.appendChild(labelElement);
    group.appendChild(select);
    
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
    const status = createSafeElement('p', 'Analyzing job description and ranking projects...', 'status-text');
    
    container.appendChild(spinner);
    container.appendChild(status);
    
    return container;
  }

  /**
   * Create results summary box
   */
  private createResultsSummary(): HTMLElement {
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
    const details = createSafeElement('div', '', 'results-details');
    
    this.lastResults.roleResults.forEach((roleResult: any) => {
      const roleSection = this.createRoleResultSection(roleResult);
      details.appendChild(roleSection);
    });
    
    return details;
  }

  /**
   * Create individual role result section
   */
  private createRoleResultSection(roleResult: any): HTMLElement {
    const section = createSafeElement('div', '', 'role-result-section');
    
    // Role header
    const header = createSafeElement('div', '', 'role-header');
    const title = createSafeElement('h4', '', 'role-title');
    setSafeTextContent(title, `${roleResult.roleTitle} - ${roleResult.selectedBullets.length} bullet points selected`);
    
    const projectsInfo = createSafeElement('p', '', 'projects-info');
    setSafeTextContent(projectsInfo, `Projects considered: ${roleResult.projectsShortlisted.join(', ')}`);
    
    header.appendChild(title);
    header.appendChild(projectsInfo);
    
    // Bullets list
    const bulletsList = createSafeElement('ul', '', 'bullets-list');
    roleResult.selectedBullets.forEach((bullet: any) => {
      const listItem = this.createBulletListItem(bullet);
      bulletsList.appendChild(listItem);
    });
    
    section.appendChild(header);
    section.appendChild(bulletsList);
    
    return section;
  }

  /**
   * Create individual bullet list item
   */
  private createBulletListItem(bullet: any): HTMLElement {
    const listItem = createSafeElement('li', '', 'bullet-item');
    
    const bulletText = createSafeElement('span', '', 'bullet-text');
    setSafeTextContent(bulletText, bullet.text);
    
    const metadata = createSafeElement('span', '', 'bullet-metadata');
    setSafeTextContent(metadata, 
      `(Relevance: ${Math.round(bullet.relevance * 100)}%, Project: ${bullet.projectName})`
    );
    
    listItem.appendChild(bulletText);
    listItem.appendChild(metadata);
    
    return listItem;
  }

  /**
   * Create results actions (copy, export)
   */
  private createResultsActions(): HTMLElement {
    const actions = createSafeElement('div', '', 'results-actions');
    
    const copyButton = document.createElement('button');
    copyButton.className = 'action-button copy-button';
    setSafeTextContent(copyButton, 'Copy All');
    copyButton.addEventListener('click', () => {
      this.copyResults();
    });
    
    const exportButton = document.createElement('button');
    exportButton.className = 'action-button export-button';
    setSafeTextContent(exportButton, 'Export to Plain Text');
    exportButton.addEventListener('click', () => {
      this.exportResults();
    });
    
    actions.appendChild(copyButton);
    actions.appendChild(exportButton);
    
    return actions;
  }

  /**
   * Create error display
   */
  private createErrorDisplay(): HTMLElement {
    const error = createSafeElement('div', '', 'error-display');
    const message = createSafeElement('p', 'Failed to generate recommendations. Please try again.', 'error-message');
    error.appendChild(message);
    return error;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle form submission
   */
  private async handleSubmission(): Promise<void> {
    const jobTitle = (document.getElementById('job-title') as HTMLInputElement)?.value || '';
    const jobDescription = (document.getElementById('job-description') as HTMLTextAreaElement)?.value || '';
    const functionBias = (document.getElementById('function-bias') as HTMLSelectElement)?.value || 'general';
    
    if (!jobDescription.trim()) {
      alert('Please enter a job description');
      return;
    }
    
    try {
      this.processingState = 'processing';
      this.render(); // Show processing state
      
      // Simple algorithm placeholder - deterministic for testing
      const results = await this.generatePlaceholderResults(jobTitle, jobDescription, functionBias);
      
      this.lastResults = results;
      this.processingState = 'complete';
      this.render();
      
    } catch (error) {
      console.error('Generation failed:', error);
      this.processingState = 'error';
      this.render();
    }
  }

  /**
   * Generate placeholder results for walking skeleton
   */
  private async generatePlaceholderResults(title: string, description: string, bias: string): Promise<any> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { roles, bullets, projects } = getSampleDataset();
    const processingTime = (1.8 + Math.random() * 1.4).toFixed(1); // 1.8-3.2s
    
    // Simple deterministic selection: pick first 2 bullets from each role
    const roleResults = roles.map(role => {
      const roleBullets = bullets.filter(b => b.roleId === role.id && b.embeddingState === 'ready');
      const selectedBullets = roleBullets.slice(0, Math.min(2, role.bulletsLimit)).map(bullet => {
        const project = projects.find(p => p.id === bullet.projectId);
        return {
          id: bullet.id,
          text: bullet.text,
          relevance: 0.85 + Math.random() * 0.1, // 85-95%
          projectName: project?.name || 'Unknown Project'
        };
      });
      
      const projectsConsidered = [...new Set(selectedBullets.map(b => b.projectName))];
      
      return {
        roleTitle: `${role.title} (${role.company})`,
        selectedBullets,
        projectsShortlisted: projectsConsidered,
        avgRelevance: selectedBullets.reduce((sum, b) => sum + b.relevance, 0) / selectedBullets.length
      };
    }).filter(result => result.selectedBullets.length > 0);
    
    const totalBullets = roleResults.reduce((sum, role) => sum + role.selectedBullets.length, 0);
    const projectsConsidered = [...new Set(roleResults.flatMap(r => r.projectsShortlisted))].length;
    
    return {
      jobTitle: title,
      totalBullets,
      processingTime: parseFloat(processingTime),
      projectsConsidered,
      roleResults,
      deepAnalysis: {
        enabled: false,
        focusSummary: `Emphasized ${bias} skills and quantitative results`
      }
    };
  }

  /**
   * Copy results to clipboard
   */
  private async copyResults(): Promise<void> {
    if (!this.lastResults) return;
    
    try {
      const text = this.formatResultsForCopy();
      await navigator.clipboard.writeText(text);
      
      // Show temporary success feedback
      const copyButton = document.querySelector('.copy-button') as HTMLButtonElement;
      if (copyButton) {
        const originalText = copyButton.textContent;
        setSafeTextContent(copyButton, 'Copied!');
        setTimeout(() => {
          setSafeTextContent(copyButton, originalText || 'Copy All');
        }, 2000);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy to clipboard');
    }
  }

  /**
   * Export results to plain text file
   */
  private exportResults(): void {
    if (!this.lastResults) return;
    
    try {
      const text = this.formatResultsForExport();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `resuum-recommendations-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export results');
    }
  }

  /**
   * Format results for clipboard copy (deterministic ordering)
   */
  private formatResultsForCopy(): string {
    const lines: string[] = [];
    
    // Sort role results by role order for deterministic output
    const sortedRoleResults = this.lastResults.roleResults.slice().sort((a: any, b: any) => {
      return a.roleTitle.localeCompare(b.roleTitle);
    });
    
    sortedRoleResults.forEach((roleResult: any) => {
      lines.push(`${roleResult.roleTitle}:`);
      lines.push('');
      
      roleResult.selectedBullets.forEach((bullet: any) => {
        lines.push(`• ${bullet.text}`);
      });
      
      lines.push('');
    });
    
    return lines.join('\n');
  }

  /**
   * Format results for file export (includes metadata)
   */
  private formatResultsForExport(): string {
    const lines: string[] = [];
    const timestamp = new Date().toLocaleString();
    
    lines.push('RESUUM RECOMMENDATIONS');
    lines.push(`Generated: ${timestamp}`);
    lines.push(`Job: ${this.lastResults.jobTitle}`);
    lines.push(`Processing time: ${this.lastResults.processingTime}s`);
    lines.push('');
    lines.push('=' .repeat(50));
    lines.push('');
    
    // Add formatted bullet points
    lines.push(this.formatResultsForCopy());
    
    return lines.join('\n');
  }
}