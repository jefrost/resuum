/**
 * Resuum - Main Application Entry Point
 * Initializes UI foundation and connects to worker architecture
 */

import { ResuumApp } from './ui/app';
import { initializeWorker, checkWorkerHealth } from './utils/worker-communication';
import { generateCompatibilityReport, getCompatibilityMessage } from './utils/feature-detection';
import { createErrorElement } from './ui/xss-safe-rendering';

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Main application initialization
 */
async function initializeApp(): Promise<void> {
  try {
    console.log('Resuum starting initialization...');
    
    // Check browser compatibility first
    const compatibility = generateCompatibilityReport();
    if (!compatibility.isSupported) {
      showCompatibilityError(compatibility);
      return;
    }
    
    // Show any compatibility warnings
    if (compatibility.warnings.length > 0) {
      console.warn('Browser compatibility warnings:', compatibility.warnings);
    }
    
    // Initialize worker architecture
    await initializeWorkerSystem();
    
    // Initialize UI
    const app = new ResuumApp('app');
    await app.initialize();
    
    // Perform health checks
    await performSystemHealthCheck();
    
    console.log('Resuum initialization completed successfully');
    
  } catch (error) {
    console.error('Failed to initialize Resuum:', error);
    showInitializationError(error);
  }
}

/**
 * Initialize worker system with proper error handling
 */
async function initializeWorkerSystem(): Promise<void> {
  try {
    // Get worker code from global variable (set by build system)
    const workerCode = getWorkerCode();
    
    if (!workerCode) {
      throw new Error('Worker code not available. Please check your build configuration.');
    }
    
    // Initialize worker with timeout
    const initTimeout = setTimeout(() => {
      throw new Error('Worker initialization timeout (30s)');
    }, 30000);
    
    await initializeWorker(workerCode);
    clearTimeout(initTimeout);
    
    console.log('Worker system initialized successfully');
    
  } catch (error) {
    throw new Error(`Worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get worker code from build system
 */
function getWorkerCode(): string | null {
  // In single-file deployment, worker code is embedded by build system
  if (typeof (window as any).WORKER_URL === 'string') {
    // Worker is already created as Blob URL by build system
    return null; // Will use the existing Blob URL
  }
  
  // Fallback: check for inline worker code
  if (typeof (window as any).WORKER_CODE === 'string') {
    return (window as any).WORKER_CODE;
  }
  
  return null;
}

/**
 * Perform system health check
 */
async function performSystemHealthCheck(): Promise<void> {
  try {
    const isHealthy = await checkWorkerHealth();
    
    if (!isHealthy) {
      console.warn('Worker health check failed - some features may not work correctly');
    } else {
      console.log('System health check passed');
    }
    
  } catch (error) {
    console.warn('Health check failed:', error);
  }
}

// ============================================================================
// Error Handling and User Messaging
// ============================================================================

/**
 * Show browser compatibility error
 */
function showCompatibilityError(compatibility: any): void {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;
  
  appContainer.innerHTML = '';
  
  const errorContainer = createErrorElement(
    getCompatibilityMessage(compatibility),
    'Browser Compatibility Issue'
  );
  
  errorContainer.style.margin = '2rem';
  errorContainer.style.padding = '2rem';
  
  appContainer.appendChild(errorContainer);
}

/**
 * /**
* Show general initialization error
*/
function showInitializationError(error: unknown): void {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    
    appContainer.innerHTML = '';
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    const errorContainer = createErrorElement(
      `Resuum failed to start: ${errorMessage}. Please refresh the page and try again.`,
      'Initialization Error'
    );
    
    errorContainer.style.margin = '2rem';
    errorContainer.style.padding = '2rem';
    
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Initialization';
    retryButton.style.marginTop = '1rem';
    retryButton.style.padding = '0.5rem 1rem';
    retryButton.style.cursor = 'pointer';
    
    retryButton.addEventListener('click', () => {
      window.location.reload();
    });
    
    errorContainer.appendChild(retryButton);
    appContainer.appendChild(errorContainer);
   }
   
   /**
   * Handle unhandled errors
   */
   function setupGlobalErrorHandling(): void {
    window.addEventListener('error', (event) => {
      console.error('Unhandled error:', event.error);
      
      // Don't interfere if app is already showing an error
      const appContainer = document.getElementById('app');
      if (appContainer && appContainer.querySelector('.error-message')) {
        return;
      }
      
      showInitializationError(event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Don't interfere if app is already showing an error
      const appContainer = document.getElementById('app');
      if (appContainer && appContainer.querySelector('.error-message')) {
        return;
      }
      
      showInitializationError(event.reason);
    });
   }
   
   // ============================================================================
   // Application Lifecycle
   // ============================================================================
   
   /**
   * Application cleanup on page unload
   */
   function setupCleanup(): void {
    window.addEventListener('beforeunload', () => {
      console.log('Resuum shutting down...');
      
      // Cleanup will be handled by individual components
      // Worker manager will terminate workers automatically
    });
   }
   
   /**
   * Development mode helpers
   */
   function setupDevelopmentHelpers(): void {
    if (process.env['NODE_ENV'] === 'development') {
      // Expose app instance for debugging
      (window as any).resumApp = null;
      
      // Add development console commands
      console.log('Development mode enabled. Available commands:');
      console.log('- checkWorkerHealth() - Check worker status');
      console.log('- getCompatibilityReport() - Check browser compatibility');
    }
   }
   
   // ============================================================================
   // Entry Point
   // ============================================================================
   
   /**
   * Start the application when DOM is ready
   */
   function bootstrap(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
      // DOM already loaded
      initializeApp();
    }
   }
   
   // Setup global error handling
   setupGlobalErrorHandling();
   
   // Setup cleanup handlers
   setupCleanup();
   
   // Setup development helpers
   setupDevelopmentHelpers();
   
   // Start the application
   bootstrap();
   
   // Export for TypeScript
   export {};