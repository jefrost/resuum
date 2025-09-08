/**
 * API Configuration Component
 * Handles OpenAI API key management
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getOpenAIService } from '../services/openai-service';

// ============================================================================
// API Config Class
// ============================================================================

export class APIConfig {
  private container: HTMLElement | null = null;

  /**
   * Render API configuration interface
   */
  async render(container: HTMLElement): Promise<void> {
    this.container = container;
    container.innerHTML = '';
    
    const description = createSafeElement('p', 
      'Your OpenAI API key is stored locally in your browser and never exported.',
      'section-description'
    );
    
    const form = this.createForm();
    
    container.appendChild(description);
    container.appendChild(form);
  }

  /**
   * Create API key form
   */
  private createForm(): HTMLElement {
    const form = createSafeElement('div', '', 'api-form');
    
    // Key input group
    const inputGroup = createSafeElement('div', '', 'input-group');
    const label = createSafeElement('label', 'OpenAI API Key', 'input-label');
    label.setAttribute('for', 'api-key');
    
    const keyInput = document.createElement('input') as HTMLInputElement;
    keyInput.type = 'password';
    keyInput.id = 'api-key';
    keyInput.className = 'form-input';
    keyInput.placeholder = 'sk-...';
    
    const openaiService = getOpenAIService();
    if (openaiService.hasApiKey()) {
      keyInput.value = '***key-stored***';
      keyInput.disabled = true;
    }
    
    inputGroup.appendChild(label);
    inputGroup.appendChild(keyInput);
    
    // Button group
    const buttonGroup = createSafeElement('div', '', 'button-group');
    
    const saveBtn = this.createSaveButton(keyInput);
    const testBtn = this.createTestButton();
    const forgetBtn = this.createForgetButton();
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(testBtn);
    buttonGroup.appendChild(forgetBtn);
    
    form.appendChild(inputGroup);
    form.appendChild(buttonGroup);
    
    return form;
  }

  /**
   * Create save button
   */
  private createSaveButton(keyInput: HTMLInputElement): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'form-button form-button--primary';
    
    const openaiService = getOpenAIService();
    setSafeTextContent(button, openaiService.hasApiKey() ? 'Update Key' : 'Save Key');
    
    button.addEventListener('click', async () => {
      await this.saveKey(keyInput.value);
    });
    
    return button;
  }

  /**
   * Create test button
   */
  private createTestButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'form-button form-button--secondary';
    setSafeTextContent(button, 'Test Connection');
    
    button.addEventListener('click', async () => {
      await this.testConnection();
    });
    
    return button;
  }

  /**
   * Create forget button
   */
  private createForgetButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'form-button form-button--danger';
    setSafeTextContent(button, 'Forget Key');
    
    const openaiService = getOpenAIService();
    button.style.display = openaiService.hasApiKey() ? 'inline-block' : 'none';
    
    button.addEventListener('click', () => {
      this.forgetKey();
    });
    
    return button;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Save API key
   */
  private async saveKey(key: string): Promise<void> {
    if (!key || key === '***key-stored***') {
      alert('Please enter a valid API key');
      return;
    }
    
    try {
      const openaiService = getOpenAIService();
      openaiService.setApiKey(key);
      
      // Test immediately
      const result = await openaiService.testConnection();
      if (!result.success) {
        openaiService.clearApiKey();
        throw new Error(result.error || 'Connection test failed');
      }
      
      alert('API key saved and tested successfully');
      if (this.container) {
        await this.render(this.container);
      }
      
    } catch (error) {
      alert(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection
   */
  private async testConnection(): Promise<void> {
    const openaiService = getOpenAIService();
    if (!openaiService.hasApiKey()) {
      alert('No API key configured');
      return;
    }
    
    try {
      const result = await openaiService.testConnection();
      if (result.success) {
        alert('Connection test successful');
      } else {
        alert(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forget API key
   */
  private forgetKey(): void {
    if (confirm('Are you sure you want to forget your API key? This will disable AI functionality.')) {
      const openaiService = getOpenAIService();
      openaiService.clearApiKey();
      
      if (this.container) {
        this.render(this.container);
      }
      
      alert('API key forgotten');
    }
  }
}