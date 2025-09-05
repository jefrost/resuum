#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import { build } from 'esbuild';

async function debugBuild() {
  console.log('🔧 Debug TypeScript build starting...');
  
  // Ensure docs directory exists
  mkdirSync('docs', { recursive: true });
  
  try {
    const result = await build({
      entryPoints: ['src/main.ts'],
      format: 'iife',
      bundle: true,
      minify: false,
      sourcemap: 'inline',
      target: 'es2020',
      write: false,
      logLevel: 'info', // Show detailed build logs
      define: {
        'process.env.NODE_ENV': '"development"'
      }
    });
    
    console.log('📦 TypeScript compilation successful');
    console.log(`📊 Bundle size: ${(result.outputFiles[0].text.length / 1024).toFixed(1)}KB`);
    
    // Create simple HTML wrapper
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript Debug Test</title>
    <style>
        body { 
            font-family: system-ui, sans-serif; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .success { 
            background: #d1fae5; 
            border: 1px solid #10b981; 
            color: #047857; 
            padding: 1rem; 
            border-radius: 8px; 
            margin: 1rem 0; 
        }
        .error { 
            background: #fef2f2; 
            border: 1px solid #f87171; 
            color: #dc2626; 
            padding: 1rem; 
            border-radius: 8px; 
            margin: 1rem 0; 
        }
        .info {
            background: #dbeafe;
            border: 1px solid #60a5fa;
            color: #1d4ed8;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <h1>TypeScript Debug Test</h1>
    <div class="info">
        <strong>Testing:</strong> TypeScript compilation and timeoutMs fix
    </div>
    <div id="app">Loading TypeScript test...</div>
    
    <script>
        console.log('🚀 Starting TypeScript debug test...');
        
        // Wrap in try-catch to catch any runtime errors
        try {
            ${result.outputFiles[0].text}
        } catch (error) {
            console.error('❌ TypeScript execution error:', error);
            document.getElementById('app').innerHTML = 
                '<div class="error"><strong>TypeScript Error:</strong> ' + error.message + '</div>';
        }
    </script>
</body>
</html>`;
    
    writeFileSync('docs/debug.html', html);
    
    console.log('✅ Debug build completed successfully');
    console.log('🔍 Test your TypeScript at: docs/debug.html');
    console.log('');
    console.log('Expected result: Green "TypeScript Working" text with no console errors');
    
  } catch (error) {
    console.error('❌ TypeScript build failed:');
    console.error('Error:', error.message);
    
    if (error.errors && error.errors.length > 0) {
      console.error('\nDetailed errors:');
      error.errors.forEach((err, index) => {
        console.error(`  ${index + 1}. ${err.location?.file}:${err.location?.line || '?'}`);
        console.error(`     ${err.text}`);
      });
    }
    
    if (error.warnings && error.warnings.length > 0) {
      console.error('\nWarnings:');
      error.warnings.forEach((warn, index) => {
        console.error(`  ${index + 1}. ${warn.location?.file}:${warn.location?.line || '?'}`);
        console.error(`     ${warn.text}`);
      });
    }
    
    console.error('\nTroubleshooting:');
    console.error('1. Check that src/main.ts exists');
    console.error('2. Verify vector-math.ts has default parameters added');
    console.error('3. Run: npm install (if dependencies are missing)');
    
    process.exit(1);
  }
}

debugBuild();