/**
 * Core type definitions for Resuum data models
 */

// ============================================================================
// Embedding State Management
// ============================================================================

export type EmbeddingState = 'ready' | 'pending' | 'stale' | 'failed';

export interface EmbeddingStateInfo {
  state: EmbeddingState;
  lastEmbeddedAt?: number;
  retryCount: number;
  failureReason?: string;
}

// ============================================================================
// Core Data Models (matching PRD specification)
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
  centroidVector: ArrayBuffer;
  vectorDimensions: number;
  bulletCount: number;
  embeddingVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface BulletFeatures {
  hasNumbers: boolean;
  actionVerb: boolean;
  lengthOk: boolean;
}

export interface Bullet {
  id: string;
  roleId: string;
  projectId: string;
  text: string;
  source: 'manual' | 'resume_import';
  normalizedFingerprint: string;
  features: BulletFeatures;
  embeddingState: EmbeddingState;
  lastEmbeddedAt?: number;
  retryCount: number;
  createdAt: number;
  lastModified: number;
}

export interface Embedding {
  bulletId: string;
  vector: ArrayBuffer;
  vendor: string;
  model: string;
  dims: number;
  version: number;
  createdAt: number;
}

export interface EmbedQueueItem {
  id: string;
  bulletId: string;
  priority: number;
  createdAt: number;
  retryCount: number;
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
// API and Processing Types
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

export interface JobAnalysis {
  title: string;
  description: string;
  embedding?: Float32Array;
  skills?: string[];
  functionBias?: FunctionBias;
}

export type FunctionBias = 'general' | 'technical' | 'business_strategy' | 'marketing' | 'operations';

export interface AlgorithmWeights {
  relevance: number;        // α - relevance to job description
  quality: number;          // μ - quality features score
  recency: number;          // ρ - recency bias
  redundancyPenalty: number; // λ - redundancy penalty
}

export interface ProjectScore {
  project: Project;
  score: number;
  similarity: number;
  recencyFactor: number;
}

export interface BulletScore {
  bullet: Bullet;
  score: number;
  relevance: number;
  qualityScore: number;
  redundancyScore: number;
}

export interface RoleResult {
  role: Role;
  projectsConsidered: Project[];
  projectsShortlisted: Project[];
  selectedBullets: BulletScore[];
  avgRelevance: number;
}

export interface GenerationResult {
  jobTitle: string;
  totalBullets: number;
  processingTime: number;
  projectsConsidered: number;
  roleResults: RoleResult[];
  deepAnalysis?: {
    enabled: boolean;
    focusSummary?: string;
    coveredSkills?: string[];
    missingSkills?: string[];
    suggestions?: string[];
  };
}

// ============================================================================
// Worker Communication Types
// ============================================================================

export interface WorkerMessage {
  type: string;
  id: string;
  data: any;
}

export interface WorkerResponse {
  type: string;
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface VectorOperation {
  jobVector: Float32Array;
  bulletVectors: Float32Array[];
  selectedVectors?: Float32Array[];
  weights?: AlgorithmWeights;
}

export interface VectorResult {
  similarities: number[];
  redundancyScores: number[];
  qualityScores: number[];
}

// ============================================================================
// UI State Types
// ============================================================================

export interface AppState {
  currentTab: 'application' | 'experience' | 'settings';
  loading: boolean;
  error?: string;
}

export interface ExperienceTabState {
  currentSubTab: 'bullets' | 'projects';
  selectedBullets: string[];
  sortBy: 'role' | 'project' | 'created' | 'modified';
  sortOrder: 'asc' | 'desc';
  filterText: string;
  filterRole?: string;
  filterProject?: string;
}

export interface ApplicationTabState {
  jobTitle: string;
  jobDescription: string;
  functionBias: FunctionBias;
  processing: boolean;
  lastResult?: GenerationResult;
  showAnalysis: boolean;
}

export interface SettingsTabState {
  apiKeySet: boolean;
  storageUsage?: {
    totalSize: number;
    bulletCount: number;
    projectCount: number;
    embeddingCount: number;
  };
}