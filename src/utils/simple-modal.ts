/**
 * Simple Modal Utility
 * Lightweight modal system for forms
 */

import { createSafeElement, setSafeTextContent } from '../ui/xss-safe-rendering';

// ============================================================================
// Simple Modal Function
// ============================================================================

/**
 * Create and show a simple modal with a form
 */
export function createSimpleModal(
  title: string,
  formContent: HTMLElement,
  onSubmit: (formData: FormData) => void | Promise<void>,
  onCancel?: () => void
): void {
  // Find the main content area to position modal correctly
  const mainContent = document.querySelector('.main-content') || document.body;
  
  // Create modal backdrop
  const backdrop = createSafeElement('div', '', 'modal-backdrop');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 250px;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  // Create modal content
  const modal = createSafeElement('div', '', 'modal-content');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  `;
  
  // Header
  const header = createSafeElement('div', '', 'modal-header');
  header.style.cssText = `
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  const titleElement = createSafeElement('h2', title, 'modal-title');
  titleElement.style.cssText = `
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close-button';
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  setSafeTextContent(closeButton, '×');
  
  header.appendChild(titleElement);
  header.appendChild(closeButton);
  
  // Body with form
  const body = createSafeElement('div', '', 'modal-body');
  body.style.cssText = `
    padding: 1.5rem;
  `;
  body.appendChild(formContent);
  
  // Footer with buttons
  const footer = createSafeElement('div', '', 'modal-footer');
  footer.style.cssText = `
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  `;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'form-button form-button--secondary';
  cancelBtn.style.cssText = `
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  `;
  setSafeTextContent(cancelBtn, 'Cancel');
  
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'form-button form-button--primary';
  submitBtn.style.cssText = `
    padding: 0.5rem 1rem;
    border: none;
    background: #3b82f6;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  `;
  setSafeTextContent(submitBtn, 'Save');
  
  footer.appendChild(cancelBtn);
  footer.appendChild(submitBtn);
  
  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  backdrop.appendChild(modal);
  
  // Event handlers
  const closeModal = () => {
    mainContent.removeChild(backdrop);
    document.removeEventListener('keydown', handleKeydown);
    if (onCancel) onCancel();
  };
  
  const handleSubmit = async () => {
    try {
      // Extract form data from all inputs in the modal
      const formData = new FormData();
      const inputs = modal.querySelectorAll('input, select, textarea');
      
      inputs.forEach((input) => {
        const element = input as HTMLInputElement;
        if (element.name) {
          if (element.type === 'checkbox') {
            formData.append(element.name, element.checked ? 'true' : 'false');
          } else {
            formData.append(element.name, element.value);
          }
        }
      });
      
      await onSubmit(formData);
      closeModal();
      
    } catch (error) {
      console.error('Modal submit error:', error);
      alert(error instanceof Error ? error.message : 'An error occurred');
    }
  };
  
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };
  
  // Add event listeners
  closeButton.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  submitBtn.addEventListener('click', handleSubmit);
  
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
  
  document.addEventListener('keydown', handleKeydown);
  
  // Show modal
  mainContent.appendChild(backdrop);
  
  // Focus first input
  const firstInput = modal.querySelector('input, select, textarea') as HTMLElement;
  if (firstInput) {
    firstInput.focus();
  }
}