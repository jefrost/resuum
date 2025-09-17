/**
 * API Configuration Component
 * Handles Anthropic API key management
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getOpenAIService, initializeOpenAIService } from '../workers/anthropic-service'; 
import { getSetting } from '../storage/transactions';

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
    
    // Initialize service first
    try {
      await initializeOpenAIService();
    } catch (error) {
      console.warn('Failed to initialize Anthropic service:', error);
    }
    
    const description = createSafeElement('p', 
      'Your Anthropic API key is stored locally in your browser and never exported.',
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
    const label = createSafeElement('label', 'Anthropic API Key', 'input-label');
    label.setAttribute('for', 'api-key');
    
    const keyInput = document.createElement('input') as HTMLInputElement;
    keyInput.type = 'password';
    keyInput.id = 'api-key';
    keyInput.className = 'form-input';
    keyInput.placeholder = 'sk-ant-...';
    
    const anthropicService = getOpenAIService();
    if (anthropicService.hasApiKey()) {
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
    
    const anthropicService = getOpenAIService();
    setSafeTextContent(button, anthropicService.hasApiKey() ? 'Update Key' : 'Save Key');
    
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
    
    const anthropicService = getOpenAIService();
    button.style.display = anthropicService.hasApiKey() ? 'inline-block' : 'none';
    
    button.addEventListener('click', () => {
      this.forgetKey();
    });
    
    return button;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Save API key with CORS workaround notice
   */
  private async saveKey(key: string): Promise<void> {
    if (!key || key === '***key-stored***') {
      alert('Please enter a valid Anthropic API key');
      return;
    }
    
    try {
      console.log('INPUT KEY:', key);
      
      const anthropicService = await initializeOpenAIService();
      await anthropicService.setApiKey(key);
      
      const storedValue = await getSetting('openai_api_key');
      console.log('STORED VALUE:', storedValue);
      console.log('SERVICE HAS KEY:', anthropicService.hasApiKey());
      console.log('SERVICE KEY VALUE:', anthropicService.hasApiKey() ? anthropicService.getApiKey() : 'NO KEY');
      
      // Show CORS notice instead of testing
      alert('Anthropic API key saved successfully.\n\nNote: Browser CORS restrictions prevent direct API testing. The key will be tested when you generate recommendations.');
      
      if (this.container) {
        await this.render(this.container);
      }
      
    } catch (error) {
      console.error('SAVE KEY ERROR:', error);
      alert(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection with CORS notice
   */
  private async testConnection(): Promise<void> {
    try {
      const anthropicService = await initializeOpenAIService();
      
      if (!anthropicService.hasApiKey()) {
        alert('No Anthropic API key configured');
        return;
      }
      
      // Show CORS limitation notice
      alert('Your Anthropic API key is saved and ready to use.\n\nDue to browser security restrictions, we cannot test the connection directly. The key will be validated when you generate recommendations.');
      
    } catch (error) {
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forget API key
   */
  private async forgetKey(): Promise<void> {
    if (confirm('Are you sure you want to forget your Anthropic API key? This will disable AI functionality.')) {
      try {
        const anthropicService = await initializeOpenAIService();
        await anthropicService.clearApiKey();
        
        if (this.container) {
          await this.render(this.container);
        }
        
        alert('Anthropic API key forgotten');
      } catch (error) {
        alert(`Failed to forget API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}