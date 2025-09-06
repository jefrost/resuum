/**
 * Sample data for development and testing
 */

import { 
    Role, 
    Project, 
    Bullet,
    Settings
  } from '../types';
  
  // ============================================================================
  // Sample Data Generation
  // ============================================================================
  
  export function getSampleDataset(): {
    roles: Role[];
    projects: Project[];
    bullets: Bullet[];
    settings: Settings[];
  } {
    // Sample roles
    const roles: Role[] = [
      {
        id: 'role_mckinsey_sc',
        title: 'Senior Consultant',
        company: 'McKinsey & Company',
        orderIndex: 0,
        bulletsLimit: 3,
        startDate: '2022-01',
        endDate: '2024-03'
      },
      {
        id: 'role_bcg_consultant',
        title: 'Consultant', 
        company: 'Boston Consulting Group',
        orderIndex: 1,
        bulletsLimit: 2,
        startDate: '2020-06',
        endDate: '2021-12'
      }
    ];
  
    // Sample projects
    const projects: Project[] = [
      {
        id: 'proj_telecom_transform',
        roleId: 'role_mckinsey_sc',
        name: 'Global Telecom Transformation',
        description: 'Digital transformation initiative for major telecom operator',
        centroidVector: new ArrayBuffer(1536 * 4), // 1536 float32s
        vectorDimensions: 1536,
        bulletCount: 3,
        embeddingVersion: 1,
        createdAt: Date.now() - 86400000, // 1 day ago
        updatedAt: Date.now()
      },
      {
        id: 'proj_healthcare_ma',
        roleId: 'role_mckinsey_sc', 
        name: 'Healthcare M&A',
        description: 'Due diligence and integration planning for healthcare acquisition',
        centroidVector: new ArrayBuffer(1536 * 4),
        vectorDimensions: 1536,
        bulletCount: 2,
        embeddingVersion: 1,
        createdAt: Date.now() - 172800000, // 2 days ago
        updatedAt: Date.now()
      },
      {
        id: 'proj_retail_strategy',
        roleId: 'role_bcg_consultant',
        name: 'Retail Strategy',
        description: 'Growth strategy development for retail chain',
        centroidVector: new ArrayBuffer(1536 * 4),
        vectorDimensions: 1536,
        bulletCount: 2,
        embeddingVersion: 1,
        createdAt: Date.now() - 259200000, // 3 days ago
        updatedAt: Date.now()
      }
    ];
  
    // Sample bullets
    const bullets: Bullet[] = [
      {
        id: 'bullet_001',
        roleId: 'role_mckinsey_sc',
        projectId: 'proj_telecom_transform',
        text: 'Led cross-functional team of 12 engineers to deliver network modernization project, achieving 25% reduction in latency and $3.2M annual cost savings',
        source: 'manual',
        normalizedFingerprint: 'sample_fingerprint_bullet_001',
        features: {
          hasNumbers: true,
          actionVerb: true,
          lengthOk: true
        },
        embeddingState: 'ready',
        lastEmbeddedAt: Date.now() - 3600000,
        retryCount: 0,
        createdAt: Date.now() - 86400000,
        lastModified: Date.now() - 3600000
      },
      {
        id: 'bullet_002',
        roleId: 'role_mckinsey_sc',
        projectId: 'proj_telecom_transform',
        text: 'Developed data-driven customer segmentation model identifying 5 high-value segments, driving 18% increase in customer acquisition efficiency',
        source: 'manual',
        normalizedFingerprint: 'sample_fingerprint_bullet_002',
        features: {
          hasNumbers: true,
          actionVerb: true,
          lengthOk: true
        },
        embeddingState: 'ready',
        lastEmbeddedAt: Date.now() - 7200000,
        retryCount: 0,
        createdAt: Date.now() - 86400000,
        lastModified: Date.now() - 7200000
      },
      {
        id: 'bullet_003',
        roleId: 'role_mckinsey_sc',
        projectId: 'proj_healthcare_ma',
        text: 'Conducted comprehensive due diligence analysis of 3 target companies, evaluating $2.1B in potential acquisitions across regulatory, financial, and operational dimensions',
        source: 'manual',
        normalizedFingerprint: 'sample_fingerprint_bullet_003',
        features: {
          hasNumbers: true,
          actionVerb: true,
          lengthOk: true
        },
        embeddingState: 'stale',
        retryCount: 0,
        createdAt: Date.now() - 172800000,
        lastModified: Date.now() - 3600000
      },
      {
        id: 'bullet_004',
        roleId: 'role_bcg_consultant',
        projectId: 'proj_retail_strategy',
        text: 'Analyzed market dynamics and competitive landscape for omnichannel retail expansion, recommending 8 strategic initiatives with projected $15M revenue impact',
        source: 'manual',
        normalizedFingerprint: 'sample_fingerprint_bullet_004',
        features: {
          hasNumbers: true,
          actionVerb: true,
          lengthOk: true
        },
        embeddingState: 'pending',
        retryCount: 1,
        createdAt: Date.now() - 259200000,
        lastModified: Date.now() - 1800000
      }
    ];
  
    // Sample settings
    const settings: Settings[] = [
      { key: 'maxPerProject', value: 1 },
      { key: 'lastExportDate', value: Date.now() - 604800000 }, // 1 week ago
      { key: 'embeddingModel', value: 'text-embedding-3-small' },
      { key: 'functionBias', value: 'general' }
    ];
  
    return { roles, projects, bullets, settings };
  }
  
  /**
   * Get role by ID from sample data
   */
  export function getRoleById(id: string): Role | null {
    const { roles } = getSampleDataset();
    return roles.find(role => role.id === id) || null;
  }
  
  /**
   * Get project by ID from sample data  
   */
  export function getProjectById(id: string): Project | null {
    const { projects } = getSampleDataset();
    return projects.find(project => project.id === id) || null;
  }
  
  /**
   * Get bullets by role ID from sample data
   */
  export function getBulletsByRoleId(roleId: string): Bullet[] {
    const { bullets } = getSampleDataset();
    return bullets.filter(bullet => bullet.roleId === roleId);
  }
  
  /**
   * Get bullets by project ID from sample data
   */
  export function getBulletsByProjectId(projectId: string): Bullet[] {
    const { bullets } = getSampleDataset();
    return bullets.filter(bullet => bullet.projectId === projectId);
  }
  
  /**
   * Get embedding state summary for all bullets
   */
  export function getEmbeddingStateSummary(): {
    ready: number;
    pending: number;
    stale: number;
    failed: number;
    total: number;
  } {
    const { bullets } = getSampleDataset();
    
    const summary = {
      ready: 0,
      pending: 0,
      stale: 0,
      failed: 0,
      total: bullets.length
    };
    
    for (const bullet of bullets) {
      summary[bullet.embeddingState]++;
    }
    
    return summary;
  }