/**
 * Sample data for testing and development
 * Updated for simplified AI-analysis approach
 */

import type { Role, Project, Bullet, Settings } from '../types';

/**
 * Get sample dataset for testing
 */
export function getSampleDataset() {
  // Sample roles
  const roles: Role[] = [
    {
      id: 'role_mckinsey_sc',
      title: 'Senior Consultant',
      company: 'McKinsey & Company',
      orderIndex: 0,
      bulletsLimit: 4,
      startDate: '2022-01',
      endDate: '2024-03'
    },
    {
      id: 'role_bcg_consultant',
      title: 'Consultant',
      company: 'BCG',
      orderIndex: 1,
      bulletsLimit: 3,
      startDate: '2020-06',
      endDate: '2022-01'
    }
  ];

  // Sample projects
  const projects: Project[] = [
    {
      id: 'proj_telecom_transform',
      roleId: 'role_mckinsey_sc',
      name: 'Global Telecom Transformation',
      description: 'Core network & go-to-market workstream',
      bulletCount: 3,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000
    },
    {
      id: 'proj_healthcare_ma',
      roleId: 'role_mckinsey_sc',
      name: 'Healthcare M&A Due Diligence',
      description: 'Financial and strategic analysis',
      bulletCount: 2,
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now() - 7200000
    },
    {
      id: 'proj_retail_strategy',
      roleId: 'role_bcg_consultant',
      name: 'Retail Omnichannel Strategy',
      description: 'Digital transformation strategy',
      bulletCount: 2,
      createdAt: Date.now() - 259200000,
      updatedAt: Date.now() - 14400000
    }
  ];

  // Sample bullets
  const bullets: Bullet[] = [
    {
      id: 'bullet_001',
      roleId: 'role_mckinsey_sc',
      projectId: 'proj_telecom_transform',
      text: 'Developed demand forecast model for 5G infrastructure services, achieving 15% improvement in accuracy vs. legacy approach and enabling $2.3M in cost savings',
      source: 'manual',
      createdAt: Date.now() - 86400000,
      lastModified: Date.now() - 3600000
    },
    {
      id: 'bullet_002',
      roleId: 'role_mckinsey_sc',
      projectId: 'proj_telecom_transform',
      text: 'Led cross-functional team of 8 engineers to implement network optimization algorithms, resulting in 25% reduction in latency across 3 major markets',
      source: 'manual',
      createdAt: Date.now() - 86400000,
      lastModified: Date.now() - 7200000
    },
    {
      id: 'bullet_003',
      roleId: 'role_mckinsey_sc',
      projectId: 'proj_healthcare_ma',
      text: 'Conducted comprehensive due diligence analysis of 3 target companies, evaluating $2.1B in potential acquisitions across regulatory, financial, and operational dimensions',
      source: 'manual',
      createdAt: Date.now() - 172800000,
      lastModified: Date.now() - 3600000
    },
    {
      id: 'bullet_004',
      roleId: 'role_bcg_consultant',
      projectId: 'proj_retail_strategy',
      text: 'Analyzed market dynamics and competitive landscape for omnichannel retail expansion, recommending 8 strategic initiatives with projected $15M revenue impact',
      source: 'manual',
      createdAt: Date.now() - 259200000,
      lastModified: Date.now() - 1800000
    }
  ];

  // Sample settings
  const settings: Settings[] = [
    { key: 'maxPerProject', value: 1 },
    { key: 'lastExportDate', value: Date.now() - 604800000 }
  ];

  return {
    roles,
    projects,
    bullets,
    settings
  };
}

/**
 * Initialize sample data in storage
 */
export async function initializeSampleData(): Promise<void> {
  const { roles, projects, bullets, settings } = getSampleDataset();
  
  try {
    // Import storage functions
    const { create } = await import('../storage/transactions');
    
    // Create sample data
    for (const role of roles) {
      await create('roles', role);
    }
    
    for (const project of projects) {
      await create('projects', project);
    }
    
    for (const bullet of bullets) {
      await create('bullets', bullet);
    }
    
    for (const setting of settings) {
      await create('settings', setting);
    }
    
    console.log('Sample data initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize sample data:', error);
    throw error;
  }
}