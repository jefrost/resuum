#!/usr/bin/env node

import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('docs', { recursive: true });

async function buildResuum() {
  try {
    console.log('Building Resuum with esbuild...');
    
    // Build TypeScript bundle
    const result = await build({
      entryPoints: ['src/main.ts'],
      bundle: true,
      format: 'iife',
      globalName: 'Resuum',
      target: 'es2022',
      write: false,
      minify: false,
      sourcemap: false,
      platform: 'browser',
      loader: {
        '.ts': 'ts'
      }
    });

    const jsBundle = result.outputFiles[0].text;

    // Create single HTML file with embedded bundle
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resuum - AI-Powered Resume Optimization</title>
    <style>
        /* Main Layout - Two Column */
        body { 
            font-family: system-ui, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: #f5f5f5; 
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            text-align: center;
            padding: 1rem 0;
            background: white;
            border-bottom: 1px solid #e5e7eb;
        }
        .header h1 {
            color: #1e293b;
            font-size: 2.5rem;
            margin: 0 0 0.5rem 0;
        }
        .header p {
            color: #64748b;
            font-size: 1.1rem;
            margin: 0;
        }

        .main-container {
            flex: 1;
            display: flex;
            min-height: 0;
        }

        /* Sidebar Navigation */
        .sidebar {
            width: 240px;
            background: white;
            border-right: 1px solid #e5e7eb;
            flex-shrink: 0;
            padding: 1rem;
        }

        .tab-navigation {
            width: 100%;
        }
        .tab-list {
            display: flex;
            flex-direction: column;
            list-style: none;
            margin: 0;
            padding: 0;
            gap: 4px;
        }
        .tab-item {
            width: 100%;
        }
        .tab-button {
            width: 100%;
            padding: 12px 16px;
            border: none;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 15px;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            text-align: left;
            color: #374151;
        }
        .tab-button:hover {
            background-color: #f3f4f6;
        }
        .tab-button--active {
            background-color: #e0f2fe;
            color: #0369a1;
            font-weight: 600;
        }

        /* Main Content Area */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding: 2rem;
        }

        .tab-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            flex: 1;
            overflow: auto;
        }
        
        /* Experience Tab Styles */
        .experience-header {
            margin-bottom: 2rem;
        }
        .section-title {
            color: #1e293b;
            margin-bottom: 1rem;
        }
        .embedding-summary {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1.5rem;
        }
        .summary-text {
            margin: 0;
            font-weight: 500;
        }
        .state-badges {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
            flex-wrap: wrap;
        }
        .summary-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .summary-badge--ready { background: #dcfce7; color: #166534; }
        .summary-badge--pending { background: #fef3c7; color: #92400e; }
        .summary-badge--stale { background: #fed7aa; color: #9a3412; }
        .summary-badge--failed { background: #fecaca; color: #991b1b; }
        
        /* Sub Navigation */
        .experience-sub-nav {
            margin-bottom: 1.5rem;
        }
        .sub-nav-list {
            display: flex;
            list-style: none;
            margin: 0;
            padding: 0;
            gap: 0.5rem;
        }
        .sub-nav-button {
            padding: 0.5rem 1rem;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .sub-nav-button--active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }
        
        /* Table Styles */
        .table-controls {
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .sort-select {
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 4px;
        }
        .bullets-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        .bullets-table th,
        .bullets-table td {
            padding: 0.75rem;
            text-align: left;
            border: 1px solid #e5e7eb;
            vertical-align: top;
        }
        .bullets-table th {
            background: #f9fafb;
            font-weight: 600;
        }
        .bullets-table tr:nth-child(even) {
            background: #f9fafb;
        }
        
        /* State Badges */
        .state-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.875rem;
            font-weight: 500;
            white-space: nowrap;
        }
        .state-badge--ready { background: #dcfce7; color: #166534; }
        .state-badge--pending { background: #fef3c7; color: #92400e; }
        .state-badge--stale { background: #fed7aa; color: #9a3412; }
        .state-badge--failed { background: #fecaca; color: #991b1b; }
        
        /* Quality Indicators */
        .quality-indicators {
            display: flex;
            gap: 0.25rem;
        }
        .quality-indicator {
            font-size: 1.2em;
        }
        .quality-indicator.active {
            opacity: 1;
        }
        .quality-indicator.inactive {
            opacity: 0.3;
        }
        
        /* Status Bar */
        .status-bar {
            margin-top: 1rem;
            padding: 0.5rem;
            border-radius: 4px;
        }
        .status-bar--loading {
            background: #fef3c7;
            color: #92400e;
        }
        .status-bar--error {
            background: #fecaca;
            color: #991b1b;
        }
        .status-bar--success {
            background: #dcfce7;
            color: #166534;
        }
        .status-bar--hidden {
            display: none;
        }
        
        /* Form Styles */
        .form-group {
            margin-bottom: 1rem;
        }
        .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        .form-input,
        .form-textarea,
        .form-select {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-family: inherit;
        }
        .form-textarea {
            resize: vertical;
        }
        .form-submit {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
        }
        .form-submit:hover {
            background: #2563eb;
        }
        .form-submit:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        
        /* Utility Classes */
        .hidden { display: none; }
        .error { 
            background: #fecaca; 
            border: 1px solid #f87171; 
            padding: 1rem; 
            border-radius: 4px; 
            color: #991b1b; 
            margin: 1rem 0;
        }
        .success {
            background: #dcfce7;
            border: 1px solid #4ade80;
            padding: 1rem;
            border-radius: 4px;
            color: #166534;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>Resuum</h1>
        <p>AI-Powered Resume Optimization</p>
    </header>
    
    <div class="main-container">
        <div class="sidebar">
            <div id="sidebar-nav"></div>
        </div>
        
        <div class="main-content">
            <main id="app">
                <div id="loading">Loading application...</div>
            </main>
        </div>
    </div>

    <script>
        ${jsBundle}
    </script>
</body>
</html>`;

    writeFileSync('docs/index.html', html);
    
    console.log('✅ Build completed successfully');
    console.log('📦 Bundle size:', Math.round(jsBundle.length / 1024), 'KB');
    console.log('📄 Output: docs/index.html');
    console.log('🚀 Your TypeScript Experience tab should now work!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    
    if (error.errors && error.errors.length > 0) {
      console.error('\nBuild errors:');
      error.errors.forEach((err, i) => {
        console.error(`  ${i + 1}. ${err.text}`);
        if (err.location) {
          console.error(`     at ${err.location.file}:${err.location.line}:${err.location.column}`);
        }
      });
    }
    
    process.exit(1);
  }
}

buildResuum();