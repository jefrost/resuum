/**
 * BM25 Bullet Prefilter
 * Simple keyword-based filtering with skills expansion
 */

import type { JobAnalysis, Bullet } from '../types';

// ============================================================================
// Configuration
// ============================================================================

const BM25_K1 = 1.5;
const BM25_B = 0.75;

// ============================================================================
// BM25 Prefilter
// ============================================================================

/**
 * Prefilter bullets using BM25 scoring with skills expansion
 */
export function prefilterWithBM25(
  jobAnalysis: JobAnalysis,
  bullets: Bullet[],
  limit: number
): Bullet[] {
  if (bullets.length === 0) return [];

  // Extract and expand search terms
  const searchTerms = extractSearchTerms(jobAnalysis);
  
  // Score all bullets
  const scored = bullets.map(bullet => ({
    bullet,
    score: calculateBM25Score(bullet.text, searchTerms, bullets)
  }));

  // Sort by score and return top results
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit).map(item => item.bullet);
}

/**
 * Extract search terms from job analysis with variants
 */
function extractSearchTerms(jobAnalysis: JobAnalysis): string[] {
  const terms = new Set<string>();
  
  // Add job title words
  jobAnalysis.title.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 2) terms.add(word);
  });
  
  // Add extracted skills with variants
  jobAnalysis.extractedSkills.forEach(skill => {
    const variants = generateSkillVariants(skill);
    variants.forEach(variant => terms.add(variant.toLowerCase()));
  });
  
  // Add key requirements words
  jobAnalysis.keyRequirements.forEach(req => {
    req.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 3) terms.add(word);
    });
  });
  
  return Array.from(terms);
}

/**
 * Generate variants for a skill term
 */
function generateSkillVariants(skill: string): string[] {
  const variants = [skill];
  const lower = skill.toLowerCase();
  
  // Add common variants
  variants.push(lower);
  variants.push(lower.replace(/\s+/g, ''));
  variants.push(lower.replace(/[^a-z0-9]/g, ''));
  
  // Add acronym if multi-word
  const words = lower.split(/\s+/);
  if (words.length > 1) {
    const acronym = words.map(w => w[0]).join('');
    if (acronym.length > 1) variants.push(acronym);
  }
  
  // Add common expansions
  const expansions: Record<string, string[]> = {
    'sql': ['database', 'queries'],
    'js': ['javascript'],
    'ai': ['artificial intelligence', 'machine learning'],
    'ml': ['machine learning'],
    'pm': ['product management', 'project management']
  };
  
  if (expansions[lower]) {
    variants.push(...expansions[lower]);
  }
  
  return variants;
}

/**
 * Calculate BM25 score for a bullet against search terms
 */
function calculateBM25Score(
  bulletText: string,
  searchTerms: string[],
  allBullets: Bullet[]
): number {
  const doc = bulletText.toLowerCase();
  const docWords = doc.split(/\s+/);
  const docLength = docWords.length;
  
  // Calculate average document length
  const avgDocLength = allBullets.reduce((sum, bullet) => {
    return sum + bullet.text.split(/\s+/).length;
  }, 0) / allBullets.length;
  
  let score = 0;
  
  for (const term of searchTerms) {
    // Term frequency in document
    const tf = docWords.filter(word => word.includes(term)).length;
    if (tf === 0) continue;
    
    // Document frequency (how many documents contain this term)
    const df = allBullets.filter(bullet => 
      bullet.text.toLowerCase().includes(term)
    ).length;
    
    // IDF calculation
    const idf = Math.log((allBullets.length - df + 0.5) / (df + 0.5));
    
    // BM25 formula
    const tfComponent = (tf * (BM25_K1 + 1)) / 
      (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength)));
    
    score += idf * tfComponent;
  }
  
  // Add quality bonuses
  score += calculateQualityBonus(bulletText);
  
  return score;
}

/**
 * Calculate quality bonus for bullet text
 */
function calculateQualityBonus(text: string): number {
  let bonus = 0;
  
  // Numbers/quantification bonus
  if (/\d+[%$]|\d+\s*(percent|million|billion|thousand)|\$\d+|\d+x/i.test(text)) {
    bonus += 0.3;
  }
  
  // Action verb bonus
  if (/^(led|managed|developed|created|implemented|optimized|increased|reduced|built|designed)/i.test(text)) {
    bonus += 0.2;
  }
  
  // Length bonus (prefer 10-30 words)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 10 && wordCount <= 30) {
    bonus += 0.1;
  }
  
  return bonus;
}