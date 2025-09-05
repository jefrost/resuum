/**
 * Pure feature detection for required browser APIs
 * No side effects - only capability checking
 */

export interface BrowserCapabilities {
    indexedDB: boolean;
    webWorkers: boolean;
    blobWorkers: boolean;
    clipboardAPI: boolean;
    fetch: boolean;
    arrayBuffer: boolean;
    textEncoder: boolean;
    crypto: boolean;
  }
  
  export interface CompatibilityReport {
    isSupported: boolean;
    capabilities: BrowserCapabilities;
    missingFeatures: string[];
    warnings: string[];
  }
  
  /**
   * Detect IndexedDB support and basic functionality
   */
  function detectIndexedDB(): boolean {
    try {
      // Check if IndexedDB exists
      if (!('indexedDB' in window)) {
        return false;
      }
      
      // Check if it's not disabled (some browsers disable in private mode)
      if (!window.indexedDB) {
        return false;
      }
      
      // Basic functionality test - can we access the interface?
      if (typeof window.indexedDB.open !== 'function') {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect Web Worker support
   */
  function detectWebWorkers(): boolean {
    try {
      return (
        'Worker' in window &&
        typeof Worker === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect Blob-based Worker support (for inline workers)
   */
  function detectBlobWorkers(): boolean {
    try {
      if (!detectWebWorkers()) {
        return false;
      }
      
      // Check if we can create Blob URLs
      if (!('Blob' in window) || !('URL' in window) || typeof URL.createObjectURL !== 'function') {
        return false;
      }
      
      // Test basic Blob creation
      const testBlob = new Blob([''], { type: 'application/javascript' });
      const url = URL.createObjectURL(testBlob);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect modern Clipboard API support
   */
  function detectClipboardAPI(): boolean {
    try {
      return (
        'navigator' in window &&
        'clipboard' in navigator &&
        typeof navigator.clipboard.writeText === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect Fetch API support
   */
  function detectFetch(): boolean {
    try {
      return (
        'fetch' in window &&
        typeof fetch === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect ArrayBuffer support (for vector storage)
   */
  function detectArrayBuffer(): boolean {
    try {
      return (
        'ArrayBuffer' in window &&
        'Float32Array' in window &&
        typeof ArrayBuffer === 'function' &&
        typeof Float32Array === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect TextEncoder/TextDecoder support
   */
  function detectTextEncoder(): boolean {
    try {
      return (
        'TextEncoder' in window &&
        'TextDecoder' in window &&
        typeof TextEncoder === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Detect Web Crypto API support (for UUID generation)
   */
  function detectCrypto(): boolean {
    try {
      return (
        'crypto' in window &&
        window.crypto &&
        'getRandomValues' in window.crypto &&
        typeof window.crypto.getRandomValues === 'function'
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Run comprehensive browser capability detection
   */
  export function detectBrowserCapabilities(): BrowserCapabilities {
    return {
      indexedDB: detectIndexedDB(),
      webWorkers: detectWebWorkers(), 
      blobWorkers: detectBlobWorkers(),
      clipboardAPI: detectClipboardAPI(),
      fetch: detectFetch(),
      arrayBuffer: detectArrayBuffer(),
      textEncoder: detectTextEncoder(),
      crypto: detectCrypto()
    };
  }
  
  /**
   * Generate compatibility report with user-friendly messaging
   */
  export function generateCompatibilityReport(): CompatibilityReport {
    const capabilities = detectBrowserCapabilities();
    const missingFeatures: string[] = [];
    const warnings: string[] = [];
    
    // Check critical features
    if (!capabilities.indexedDB) {
      missingFeatures.push('IndexedDB (required for data storage)');
    }
    
    if (!capabilities.webWorkers) {
      missingFeatures.push('Web Workers (required for AI processing)');
    }
    
    if (!capabilities.fetch) {
      missingFeatures.push('Fetch API (required for OpenAI integration)');
    }
    
    if (!capabilities.arrayBuffer) {
      missingFeatures.push('ArrayBuffer support (required for vector processing)');
    }
    
    // Check recommended features
    if (!capabilities.blobWorkers) {
      warnings.push('Blob Workers not supported - will use fallback worker loading');
    }
    
    if (!capabilities.clipboardAPI) {
      warnings.push('Modern Clipboard API not supported - will use legacy clipboard methods');
    }
    
    if (!capabilities.textEncoder) {
      warnings.push('TextEncoder not supported - may affect text processing performance');
    }
    
    if (!capabilities.crypto) {
      warnings.push('Web Crypto API not supported - will use fallback ID generation');
    }
    
    const isSupported = missingFeatures.length === 0;
    
    return {
      isSupported,
      capabilities,
      missingFeatures,
      warnings
    };
  }
  
  /**
   * Browser compatibility constants
   */
  export const BROWSER_REQUIREMENTS = {
    chrome: 91,
    firefox: 90,
    safari: 14,
    edge: 91
  } as const;
  
  /**
   * Get user-friendly compatibility message
   */
  export function getCompatibilityMessage(report: CompatibilityReport): string {
    if (report.isSupported) {
      if (report.warnings.length === 0) {
        return 'Your browser fully supports all Resuum features.';
      } else {
        return `Resuum will work with minor limitations: ${report.warnings.join(', ')}`;
      }
    } else {
      return `Resuum requires a modern browser. Missing features: ${report.missingFeatures.join(', ')}. Please use Chrome 91+, Firefox 90+, Safari 14+, or Edge 91+.`;
    }
  }
  
  /**
   * Check if current browser meets minimum requirements
   */
  export function meetsMinimumRequirements(): boolean {
    const report = generateCompatibilityReport();
    return report.isSupported;
  }