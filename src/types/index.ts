/**
 * Core type definitions for Resuum data models
 */

// ============================================================================
// Core Data Models (simplified for AI analysis)
// ============================================================================

export interface Role {
    id: string;
    title: string;
    company: string;
    orderIndex: number;
    bulletsLimit: number;
    startDate: string;
    endDate: string | null;
  }
  
  export interface Project {
    id: string;
    roleId: string;
    name: string;
    description: string;
    bulletCount: number;
    createdAt: number;
    updatedAt: number;
  }
  
  export interface Bullet {
    id: string;
    roleId: string;
    projectId: string;
    text: string;
    source: 'manual' | 'resume_import';
    createdAt: number;
    lastModified: number;
  }
  
  export interface Settings {
    key: string;
    value: string | number | boolean;
  }
  
  // ============================================================================
  // IndexedDB Schema Types
  // ============================================================================
  
  export interface IndexedDBStore {
    name: string;
    keyPath: string;
    indexes?: IndexedDBIndex[];
  }
  
  export interface IndexedDBIndex {
    name: string;
    keyPath: string | string[];
    options?: {
      unique?: boolean;
      multiEntry?: boolean;
    };
  }
  
  export interface DatabaseSchema {
    name: string;
    version: number;
    stores: IndexedDBStore[];
  }
  
  // ============================================================================
  // OpenAI API Types
  // ============================================================================
  
  export interface OpenAIEmbeddingResponse {
    object: string;
    data: Array<{
      object: string;
      embedding: number[];
      index: number;
    }>;
    model: string;
    usage: {
      prompt_tokens: number;
      total_tokens: number;
    };
  }
  
  export interface APIError {
    error: {
      message: string;
      type: string;
      param?: string;
      code?: string;
    };
  }
  
  // ============================================================================
  // Job Analysis Types (AI-powered)
  // ============================================================================
  
  export interface JobAnalysis {
    title: string;
    description: string;
    extractedSkills: string[];
    keyRequirements: string[];
    roleLevel: 'entry' | 'mid' | 'senior' | 'executive';
    functionType: string;
    companyContext?: string;
  }
  
  export interface BulletEvaluation {
    bulletId: string;
    relevanceScore: number;
    matchedSkills: string[];
    reasoning: string;
    strengthAreas: string[];
  }
  
  export interface RecommendationResult {
    jobTitle: string;
    totalBullets: number;
    processingTime: number;
    roleResults: RoleResult[];
  }
  
  export interface RoleResult {
    roleId: string;
    roleTitle: string;
    selectedBullets: BulletResult[];
    projectsUsed: string[];
    avgRelevance: number;
  }
  
  export interface BulletResult {
    bulletId: string;
    text: string;
    relevanceScore: number;
    projectName: string;
    matchedSkills: string[];
  }
  
  // ============================================================================
  // UI State and Navigation Types
  // ============================================================================
  
  export type TabName = 'application' | 'experience' | 'settings';
  
  export interface AppState {
    currentTab: TabName;
    loading: boolean;
    error?: string;
    success?: string;
  }
  
  export interface TabConfig {
    id: TabName;
    label: string;
    icon: string;
    description: string;
  }
  
  // ============================================================================
  // Processing and Service Types
  // ============================================================================
  
  export interface ProcessingStatus {
    stage: 'analyzing_job' | 'evaluating_bullets' | 'selecting_results' | 'complete' | 'error';
    progress: number;
    message: string;
  }