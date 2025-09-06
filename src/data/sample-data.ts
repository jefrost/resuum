/**
 * Hardcoded Sample Data for Walking Skeleton
 * Realistic data with stable UUIDs and embedding states
 */

import type { 
    Role, 
    Project, 
    Bullet, 
    EmbeddingState,
    BulletFeatures
  } from '../types/index';
  
  // ============================================================================
  // Sample Roles (Chronological Order)
  // ============================================================================
  
  export const SAMPLE_ROLES: Role[] = [
    {
      id: 'role_mckinsey_sc_001',
      title: 'Senior Consultant',
      company: 'McKinsey & Company',
      orderIndex: 0,
      bulletsLimit: 4,
      startDate: '2022-06',
      endDate: null // Current role
    },
    {
      id: 'role_bcg_consultant_002',
      title: 'Consultant',
      company: 'Boston Consulting Group',
      orderIndex: 1,
      bulletsLimit: 3,
      startDate: '2020-09',
      endDate: '2022-05'
    },
    {
      id: 'role_goldman_analyst_003',
      title: 'Investment Banking Analyst',
      company: 'Goldman Sachs',
      orderIndex: 2,
      bulletsLimit: 3,
      startDate: '2018-07',
      endDate: '2020-08'
    }
  ];
  
  // ============================================================================
  // Sample Projects
  // ============================================================================
  
  export const SAMPLE_PROJECTS: Project[] = [
    {
      id: 'proj_telecom_transform_001',
      roleId: 'role_mckinsey_sc_001',
      name: 'Global Telecom Transformation',
      description: 'Core network modernization and go-to-market strategy',
      centroidVector: new ArrayBuffer(1536 * 4),
      vectorDimensions: 1536,
      bulletCount: 3,
      embeddingVersion: 1,
      createdAt: 1672531200000,
      updatedAt: Date.now()
    },
    {
      id: 'proj_healthcare_ma_002',
      roleId: 'role_mckinsey_sc_001',
      name: 'Healthcare M&A Due Diligence',
      description: 'Strategic and operational due diligence for $2.5B acquisition',
      centroidVector: new ArrayBuffer(1536 * 4),
      vectorDimensions: 1536,
      bulletCount: 2,
      embeddingVersion: 1,
      createdAt: 1675209600000,
      updatedAt: Date.now()
    }
  ];
  
  // ============================================================================
  // Sample Bullets
  // ============================================================================
  
  export const SAMPLE_BULLETS: Bullet[] = [
    {
      id: 'bullet_telecom_001',
      roleId: 'role_mckinsey_sc_001',
      projectId: 'proj_telecom_transform_001',
      text: 'Led cross-functional team of 12 engineers to develop 5G infrastructure demand forecast model, achieving 15% improvement in accuracy',
      source: 'manual',
      normalizedFingerprint: 'led cross functional team of <NUM> engineers to develop <NUM> infrastructure demand forecast model achieving <NUM> improvement in accuracy',
      features: {
        hasNumbers: true,
        actionVerb: true,
        lengthOk: true
      },
      embeddingState: 'ready',
      lastEmbeddedAt: Date.now() - 86400000,
      retryCount: 0,
      createdAt: 1672531200000,
      lastModified: 1672531200000
    },
    {
      id: 'bullet_telecom_002',
      roleId: 'role_mckinsey_sc_001',
      projectId: 'proj_telecom_transform_001',
      text: 'Designed go-to-market strategy for new network services, conducting market analysis across 8 regions',
      source: 'manual',
      normalizedFingerprint: 'designed go to market strategy for new network services conducting market analysis across <NUM> regions',
      features: {
        hasNumbers: true,
        actionVerb: true,
        lengthOk: true
      },
      embeddingState: 'pending',
      retryCount: 1,
      createdAt: 1672617600000,
      lastModified: Date.now()
    }
  ];
  
  // ============================================================================
  // Helper Functions
  // ============================================================================
  
  export function getSampleDataset() {
    return {
      roles: SAMPLE_ROLES,
      projects: SAMPLE_PROJECTS,
      bullets: SAMPLE_BULLETS
    };
  }
  
  export function getEmbeddingStateSummary() {
    const states = SAMPLE_BULLETS.reduce((acc, bullet) => {
      acc[bullet.embeddingState] = (acc[bullet.embeddingState] || 0) + 1;
      return acc;
    }, {} as Record<EmbeddingState, number>);
  
    return {
      ready: states.ready || 0,
      pending: states.pending || 0,
      stale: states.stale || 0,
      failed: states.failed || 0,
      total: SAMPLE_BULLETS.length
    };
  }

  export function getRoleById(roleId: string): Role | undefined {
    return SAMPLE_ROLES.find(role => role.id === roleId);
  }
  
  export function getProjectById(projectId: string): Project | undefined {
    return SAMPLE_PROJECTS.find(project => project.id === projectId);
  }
  
  export function getBulletsByRole(roleId: string): Bullet[] {
    return SAMPLE_BULLETS.filter(bullet => bullet.roleId === roleId);
  }
  
  export function getProjectsByRole(roleId: string): Project[] {
    return SAMPLE_PROJECTS.filter(project => project.roleId === roleId);
  }