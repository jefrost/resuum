/**
 * API Configuration Component
 * Handles OpenAI API key management (browser-compatible)
 */

import { createSafeElement, setSafeTextContent } from './xss-safe-rendering';
import { getOpenAIService, initializeOpenAIService } from '../workers/openai-service';
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
      console.warn('Failed to initialize OpenAI service:', error);
    }
    
    const description = createSafeElement('p', 
      'Your OpenAI API key is stored locally in your browser and never exported. OpenAI works directly from the browser.',
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
    keyInput.placeholder = 'sk-proj-...';
    
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
   * Save API key - DEBUG VERSION
   */
  private async saveKey(key: string): Promise<void> {
    if (!key || key === '***key-stored***') {
      alert('Please enter a valid OpenAI API key');
      return;
    }
    
    try {
      console.log('INPUT KEY:', key); // DEBUG
      
      // Ensure service is initialized
      const openaiService = await initializeOpenAIService();
      
      // Set the key and wait for storage to complete
      await openaiService.setApiKey(key);
      
      // DEBUG: Check what was actually stored
      const storedValue = await getSetting('openai_api_key');
      console.log('STORED VALUE:', storedValue); // DEBUG
      
      // DEBUG: Check what service thinks it has
      console.log('SERVICE HAS KEY:', openaiService.hasApiKey()); // DEBUG
      console.log('SERVICE KEY VALUE:', openaiService.hasApiKey() ? openaiService.getApiKey() : 'NO KEY'); // DEBUG
      
      // Small delay to ensure storage completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test immediately using OpenAI service method
      const result = await openaiService.testApiKey();
      if (!result.isValid) {
        await openaiService.clearApiKey();
        throw new Error(result.error || 'Connection test failed');
      }
      
      alert('OpenAI API key saved and tested successfully');
      if (this.container) {
        await this.render(this.container);
      }
      
    } catch (error) {
      console.error('SAVE KEY ERROR:', error); // DEBUG
      alert(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection - DEBUG VERSION
   */
  private async testConnection(): Promise<void> {
    try {
      console.log('TESTING CONNECTION...'); // DEBUG
      
      // Ensure service is initialized
      const openaiService = await initializeOpenAIService();
      
      if (!openaiService.hasApiKey()) {
        console.log('NO API KEY FOUND'); // DEBUG
        alert('No OpenAI API key configured');
        return;
      }
      
      console.log('SERVICE HAS KEY, TESTING...'); // DEBUG
      const result = await openaiService.testApiKey();
      console.log('TEST RESULT:', result); // DEBUG
      
      if (result.isValid) {
        alert('Connection test successful');
      } else {
        alert(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('TEST CONNECTION ERROR:', error); // DEBUG
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forget API key
   */
  private async forgetKey(): Promise<void> {
    if (confirm('Are you sure you want to forget your OpenAI API key? This will disable AI functionality.')) {
      try {
        const openaiService = await initializeOpenAIService();
        await openaiService.clearApiKey();
        
        if (this.container) {
          await this.render(this.container);
        }
        
        alert('OpenAI API key forgotten');
      } catch (error) {
        alert(`Failed to forget API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}