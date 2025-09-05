/**
 * XSS-Safe Rendering Utilities
 * Ensures all user content is rendered safely without HTML injection
 */

// ============================================================================
// XSS Prevention Core Functions
// ============================================================================

/**
 * Escape HTML characters in text content
 */
export function escapeHtml(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Create text node safely (preferred method for user content)
   */
  export function createSafeTextNode(text: string): Text {
    return document.createTextNode(text || '');
  }
  
  /**
   * Set text content safely on an element
   */
  export function setSafeTextContent(element: Element, text: string): void {
    // Clear existing content first
    element.textContent = '';
    
    // Add safe text node
    element.appendChild(createSafeTextNode(text));
  }
  
  /**
   * Create safe HTML element with text content
   */
  export function createSafeElement(
    tagName: string, 
    textContent?: string, 
    className?: string
  ): HTMLElement {
    const element = document.createElement(tagName);
    
    if (className) {
      element.className = className;
    }
    
    if (textContent) {
      setSafeTextContent(element, textContent);
    }
    
    return element;
  }
  
  // ============================================================================
  // Bullet Point Rendering
  // ============================================================================
  
  /**
   * Render bullet point text safely with embedding state indicator
   */
  export function renderBulletPoint(
    bulletText: string,
    embeddingState: 'ready' | 'pending' | 'stale' | 'failed'
  ): HTMLElement {
    const container = createSafeElement('div', '', 'bullet-point-container');
    
    // Create text content safely
    const textElement = createSafeElement('span', bulletText, 'bullet-text');
    
    // Create embedding state badge
    const stateElement = createSafeElement('span', '', `embedding-state embedding-state--${embeddingState}`);
    setSafeTextContent(stateElement, getEmbeddingStateLabel(embeddingState));
    
    container.appendChild(textElement);
    container.appendChild(stateElement);
    
    return container;
  }
  
  /**
   * Get user-friendly label for embedding state
   */
  function getEmbeddingStateLabel(state: string): string {
    switch (state) {
      case 'ready': return '✓';
      case 'pending': return '⏳';
      case 'stale': return '⚠';
      case 'failed': return '✗';
      default: return '?';
    }
  }
  
  // ============================================================================
  // Table Rendering (for Experience tab)
  // ============================================================================
  
  /**
   * Create safe table cell with text content
   */
  export function createSafeTableCell(
    tagName: 'td' | 'th',
    content: string,
    className?: string
  ): HTMLTableCellElement {
    const cell = document.createElement(tagName);
    
    if (className) {
      cell.className = className;
    }
    
    setSafeTextContent(cell, content);
    return cell;
  }
  
  /**
   * Create table row with safe cell content
   */
  export function createSafeTableRow(
    cells: Array<{ content: string; className?: string }>,
    rowClassName?: string
  ): HTMLTableRowElement {
    const row = document.createElement('tr');
    
    if (rowClassName) {
      row.className = rowClassName;
    }
    
    cells.forEach(cellData => {
      const cell = createSafeTableCell('td', cellData.content, cellData.className);
      row.appendChild(cell);
    });
    
    return row;
  }
  
  // ============================================================================
  // Form Input Sanitization
  // ============================================================================
  
  /**
   * Sanitize form input values
   */
  export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Remove potential script injections and normalize whitespace
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
  
  /**
   * Validate and sanitize job description input
   */
  export function sanitizeJobDescription(description: string): string {
    const sanitized = sanitizeInput(description);
    
    // Normalize line breaks and excessive whitespace
    return sanitized
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
  
  // ============================================================================
  // Deterministic Output Formatting
  // ============================================================================
  
  /**
   * Format bullet points for Copy/Export with deterministic ordering
   */
  export function formatBulletsForExport(
    bullets: Array<{
      id: string;
      text: string;
      roleTitle: string;
      projectName: string;
      createdAt: number;
    }>
  ): string {
    // Sort deterministically: role order → project name → createdAt
    const sortedBullets = [...bullets].sort((a, b) => {
      // Primary: role title (alphabetical for now - could use role order)
      if (a.roleTitle !== b.roleTitle) {
        return a.roleTitle.localeCompare(b.roleTitle);
      }
      
      // Secondary: project name
      if (a.projectName !== b.projectName) {
        return a.projectName.localeCompare(b.projectName);
      }
      
      // Tertiary: creation date (oldest first)
      return a.createdAt - b.createdAt;
    });
    
    // Format as plain text with consistent structure
    return sortedBullets
      .map(bullet => `• ${bullet.text}`)
      .join('\n');
  }
  
  /**
   * Format results for clipboard with metadata
   */
  export function formatResultsForClipboard(
    jobTitle: string,
    bullets: Array<{
      id: string;
      text: string;
      roleTitle: string;
      projectName: string;
      relevance: number;
      createdAt: number;
    }>
  ): string {
    const header = jobTitle ? `Resume bullets for: ${sanitizeInput(jobTitle)}\n${'='.repeat(50)}\n\n` : '';
    const formattedBullets = formatBulletsForExport(bullets);
    const footer = `\n\nGenerated by Resuum • ${bullets.length} bullets selected`;
    
    return header + formattedBullets + footer;
  }
  
  // ============================================================================
  // Clipboard Operations
  // ============================================================================
  
  /**
   * Copy text to clipboard with comprehensive fallbacks
   */
  export async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) {
      return false;
    }
    
    try {
      // Modern Clipboard API (preferred)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // Fallback: create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return success;
      
    } catch (error) {
      console.warn('Clipboard copy failed:', error);
      return false;
    }
  }
  
  // ============================================================================
  // Error Display
  // ============================================================================
  
  /**
   * Create safe error message element
   */
  export function createErrorElement(
    message: string,
    title?: string
  ): HTMLElement {
    const container = createSafeElement('div', '', 'error-message');
    
    if (title) {
      const titleElement = createSafeElement('h3', title, 'error-title');
      container.appendChild(titleElement);
    }
    
    const messageElement = createSafeElement('p', message, 'error-text');
    container.appendChild(messageElement);
    
    return container;
  }
  
  /**
   * Create safe success message element
   */
  export function createSuccessElement(message: string): HTMLElement {
    return createSafeElement('div', message, 'success-message');
  }
  
  // ============================================================================
  // Validation Utilities
  // ============================================================================
  
  /**
   * Validate that content is safe for rendering
   */
  export function validateSafeContent(content: unknown): content is string {
    return typeof content === 'string' && 
           content.length > 0 && 
           !content.includes('<script') &&
           !content.includes('javascript:') &&
           !content.includes('on');
  }
  
  /**
   * Create safe attribute value
   */
  export function createSafeAttribute(value: string): string {
    return value
      .replace(/['"<>&]/g, (char) => {
        switch (char) {
          case '"': return '&quot;';
          case "'": return '&#x27;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          default: return char;
        }
      });
  }