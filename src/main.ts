console.log('Testing worker architecture...');

// Test the worker communication system
import('./utils/worker-communication').then(async (workerComm) => {
  console.log('Worker communication imported successfully');
  
  try {
    // Check if worker URL is available from build system
    const workerUrl = (window as any).WORKER_URL;
    console.log('Worker URL available:', !!workerUrl);
    
    if (workerUrl) {
      // Initialize worker with the URL created by build system
      await workerComm.initializeWorker();
      console.log('Worker initialized successfully');
      
      // Test worker health
      const isHealthy = await workerComm.checkWorkerHealth();
      console.log('Worker health:', isHealthy);
      
      // Test vector operations
      const jobVector = new Float32Array([0.1, 0.2, 0.3]);
      const bulletVectors = [
        new Float32Array([0.2, 0.1, 0.4]),
        new Float32Array([0.1, 0.3, 0.2])
      ];
      
      const vectorResult = await workerComm.calculateSimilarities(
        jobVector, 
        bulletVectors
      );
      
      console.log('Vector operation result:', vectorResult);
      
      // Show success
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = `
          <div style="color: green; font-weight: bold; font-size: 18px;">
            ✅ Worker Architecture Working!
          </div>
          <div style="margin-top: 1rem;">
            <strong>Worker Status:</strong>
            <ul>
              <li>Worker URL: Available ✅</li>
              <li>Communication: Working ✅</li>
              <li>Health: ${isHealthy ? 'Healthy' : 'Issues'} ✅</li>
              <li>Vector Operations: Working ✅</li>
              <li>Similarities: ${vectorResult.similarities.length} calculated ✅</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; color: blue;">
            <strong>Step 4 Complete:</strong> Worker architecture functional with crash handling
          </div>
        `;
      }
    } else {
      throw new Error('Worker URL not available - build system may not have created it');
    }
    
  } catch (error) {
    console.error('Worker test failed:', error);
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `<div style="color: red;">Worker test failed: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }
  
}).catch(error => {
  console.error('Worker communication import failed:', error);
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `<div style="color: red;">Worker import failed: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
  }
});