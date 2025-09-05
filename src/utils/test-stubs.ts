/**
 * Test utilities for deterministic embedding stubs and golden dataset testing
 */

/**
 * Seeded random number generator for deterministic test vectors
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Generate deterministic embedding vector for testing
 */
export function createDeterministicEmbedding(text: string, dimensions: number = 1536): Float32Array {
  const seeded = new SeededRandom(hashString(text));
  const vector = new Float32Array(dimensions);
  
  for (let i = 0; i < dimensions; i++) {
    vector[i] = (seeded.next() - 0.5) * 2; // Range: -1 to 1
  }
  
  // Normalize vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      const currentValue = vector[i] ?? 0;
      vector[i] = currentValue / magnitude;
    }
  }
  
  return vector;
}

/**
 * Simple string hash function for seeding
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Mock data generators for testing
 */
export const MockData = {
  /**
   * Generate test role data with stable UUIDs
   */
  createRole(index: number = 0) {
    return {
      id: `role_test_${index.toString().padStart(3, '0')}`,
      title: `Test Role ${index}`,
      company: `Test Company ${index}`,
      orderIndex: index,
      bulletsLimit: 3,
      startDate: '2022-01',
      endDate: index === 0 ? null : '2024-03'
    };
  },

  /**
   * Generate test project data with stable UUIDs
   */
  createProject(roleId: string, index: number = 0) {
    const now = Date.now();
    return {
      id: `proj_test_${index.toString().padStart(3, '0')}`,
      roleId,
      name: `Test Project ${index}`,
      description: `Test project description ${index}`,
      centroidVector: new ArrayBuffer(0), // Will be calculated
      bulletCount: 0,
      createdAt: now - (index * 86400000), // Spaced by days
      updatedAt: now
    };
  },

  /**
   * Generate test bullet data with various quality patterns
   */
  createBullet(roleId: string, projectId: string, index: number = 0) {
    const bullets = [
      {
        text: 'Led cross-functional team of 12 engineers to deliver $2.5M cost optimization initiative, achieving 15% reduction in operational expenses',
        hasNumbers: true,
        actionVerb: true,
        lengthOk: true
      },
      {
        text: 'Analyzed market trends and competitive landscape',
        hasNumbers: false,
        actionVerb: true,
        lengthOk: true
      },
      {
        text: 'Collaborated with stakeholders to identify process improvements resulting in 20% efficiency gains across 5 departments',
        hasNumbers: true,
        actionVerb: true,
        lengthOk: false // Too long
      },
      {
        text: 'Responsible for various tasks',
        hasNumbers: false,
        actionVerb: false, // Weak verb
        lengthOk: false // Too short
      }
    ];
    
    const bulletIndex = Math.max(0, index % bullets.length);
    const bullet = bullets[bulletIndex];
    
    if (!bullet) {
      throw new Error(`No bullet found at index ${bulletIndex}`);
    }
    
    const now = Date.now();
    
    return {
      id: `bullet_test_${index.toString().padStart(3, '0')}`,
      roleId,
      projectId,
      text: bullet.text,
      source: 'manual' as const,
      normalizedFingerprint: normalizeForFingerprint(bullet.text),
      features: {
        hasNumbers: bullet.hasNumbers,
        actionVerb: bullet.actionVerb,
        lengthOk: bullet.lengthOk
      },
      createdAt: now - (index * 3600000), // Spaced by hours
      lastModified: now
    };
  },

  /**
   * XSS test data to validate safe rendering
   */
  createXSSTestBullets() {
    return [
      {
        id: 'xss_test_001',
        text: '<script>alert("XSS")</script>Led team to success',
        description: 'Script tag injection'
      },
      {
        id: 'xss_test_002', 
        text: 'Achieved <img src="x" onerror="alert(1)"> 15% improvement',
        description: 'Image tag with onerror'
      },
      {
        id: 'xss_test_003',
        text: 'Developed solution with <a href="javascript:alert(1)">impressive</a> results',
        description: 'JavaScript URL in link'
      },
      {
        id: 'xss_test_004',
        text: 'Created &#x3C;script&#x3E;alert("encoded")&#x3C;/script&#x3E; system',
        description: 'HTML entity encoded script'
      }
    ];
  }
};

/**
 * Normalize text for fingerprinting (simple version for testing)
 */
function normalizeForFingerprint(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\d+/g, '<NUM>') // Mask numbers
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Generate golden dataset for algorithm testing
 */
export function createGoldenDataset() {
  const role = MockData.createRole(0);
  const projects = [
    MockData.createProject(role.id, 0),
    MockData.createProject(role.id, 1),
    MockData.createProject(role.id, 2)
  ];
  
  const bullets = projects.flatMap((project, projectIndex) => 
    Array.from({ length: 3 }, (_, bulletIndex) => 
      MockData.createBullet(role.id, project.id, projectIndex * 3 + bulletIndex)
    )
  );
  
  // Generate embeddings for all bullets
  const now = Date.now();
  const embeddings = bullets.map(bullet => ({
    bulletId: bullet.id,
    vector: createDeterministicEmbedding(bullet.text),
    vendor: 'openai',
    model: 'text-embedding-3-small',
    dims: 1536,
    createdAt: now
  }));
  
  return {
    role,
    projects,
    bullets,
    embeddings
  };
}

/**
 * Test job descriptions with known similarity patterns
 */
export const TestJobDescriptions = {
  technical: {
    title: 'Senior Software Engineer',
    description: 'Lead development of scalable systems, optimize performance, and mentor junior engineers. Requires experience with distributed systems and 5+ years of engineering leadership.',
    expectedMatches: ['Led cross-functional team', 'cost optimization'] // Should match leadership and optimization bullets
  },
  
  strategy: {
    title: 'Strategy Consultant', 
    description: 'Analyze market opportunities, develop strategic recommendations, and work with C-level executives. Strong analytical skills and client management experience required.',
    expectedMatches: ['Analyzed market trends', 'cross-functional team'] // Should match analysis and collaboration
  },
  
  operations: {
    title: 'Operations Manager',
    description: 'Improve operational efficiency, manage process optimization, and drive cost reduction initiatives. Experience with process improvement and team leadership.',
    expectedMatches: ['cost optimization', 'process improvements'] // Should match efficiency and cost themes
  }
};