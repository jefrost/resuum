import { ResuumApp } from './ui/app';

console.log('Main.ts loaded - initializing app...');

// Remove loading message
const loadingDiv = document.getElementById('loading');
if (loadingDiv) {
  loadingDiv.remove();
}

// Initialize the app directly
try {
  const app = new ResuumApp('app');
  app.initialize();
  console.log('ResuumApp initialized successfully');
} catch (error) {
  console.error('App initialization failed:', error);
  const container = document.getElementById('app');
  if (container) {
    container.innerHTML = `<div style="color: red; padding: 1rem;">
      App failed to load: ${error instanceof Error ? error.message : 'Unknown error'}
      <br><br>
      Check browser console for details.
    </div>`;
  }
}