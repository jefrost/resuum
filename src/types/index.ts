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
// Processing and Service Types
// ============================================================================

export interface EmbeddingProcessorStats {
  isProcessing: boolean;
  processed: number;
  failed: number;
  queueSize: number;
  uptime: number;
}

export interface OpenAIServiceConfig {
  model?: string;
  dimensions?: number;
  skipCache?: boolean;
}

export interface BatchEmbeddingOptions extends OpenAIServiceConfig {
  onProgress?: (completed: number, total: number) => void;
}

// ============================================================================
// Job Analysis and Recommendation Types
// ============================================================================

export interface JobAnalysis {
  title: string;
  description: string;
  embedding?: Float32Array;
  skills?: string[];
  requirements?: string[];
  functionBias?: string;
}

export interface ProjectScore {
  projectId: string;
  score: number;
  relevanceScore: number;
  qualityScore: number;
  recencyScore: number;
}

export interface BulletScore {
  bulletId: string;
  score: number;
  relevanceScore: number;
  qualityScore: number;
  redundancyPenalty: number;
}

export interface RoleResult {
  roleId: string;
  roleTitle: string;
  selectedBullets: BulletScore[];
  projectsConsidered: string[];
  avgRelevance: number;
}

export interface RecommendationResult {
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
// UI State and Navigation Types
// ============================================================================

export type TabId = 'new_application' | 'experience' | 'settings';

export interface TabConfig {
  id: TabId;
  label: string;
  icon?: string;
}

export interface AppState {
  currentTab: TabId;
  isLoading: boolean;
  error: string | null;
  lastJobDescription?: string;
  lastResult?: RecommendationResult;
}

// ============================================================================
// Function Bias and Algorithm Configuration
// ============================================================================

export type FunctionBias = 'general' | 'technical' | 'business_strategy' | 'marketing' | 'operations';

export interface AlgorithmWeights {
  relevance: number; // α - relevance to job description
  quality: number; // μ - quality features weight
  recency: number; // ρ - recency bias
  redundancy: number; // λ - redundancy penalty
}

export interface FunctionBiasConfig {
  [key: string]: AlgorithmWeights;
}

// ============================================================================
// Vector Operations and Worker Types
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
  processingTime: number;
}

export interface VectorOperationData {
  operation: 'cosine_similarity' | 'batch_similarity' | 'mmr_selection';
  vectors: Float32Array[];
  targetVector?: Float32Array;
  selectedVectors?: Float32Array[];
  threshold?: number;
  limit?: number;
}

export interface VectorPerformanceMetrics {
  operationsCount: number;
  totalTimeMs: number;
  averageTimeMs: number;
  lastOperationTime: number;
}