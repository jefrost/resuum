/**
 * Bullet validation and quality analysis (40 lines)
 */

import { setSafeTextContent } from './xss-safe-rendering';
import type { BulletFeatures } from '../types';

export class BulletValidator {
  validate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.text) errors.push('Please enter bullet point text');
    if (data.text.length > 500) errors.push('Bullet point is too long (maximum 500 characters)');
    if (data.roleId === 'new_role' && (!data.newRoleTitle || !data.newRoleCompany)) {
      errors.push('Please enter role title and company');
    }
    if (data.projectId === 'new_project' && !data.newProjectName) {
      errors.push('Please enter project name');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  analyzeFeatures(text: string): BulletFeatures {
    const wordCount = text.trim().split(/\s+/).length;
    
    return {
      hasNumbers: /\d/.test(text),
      actionVerb: /^(led|managed|developed|created|built|achieved|analyzed|designed|implemented)/i.test(text.trim()),
      lengthOk: wordCount >= 5 && wordCount <= 22
    };
  }

  updateCharCounter(text: string, counter: HTMLElement): void {
    const length = text.length;
    const maxLength = 500;
    
    setSafeTextContent(counter, `${length}/${maxLength} characters`);
    
    if (length > maxLength * 0.9) {
      counter.className = 'char-counter char-counter--warning';
    } else if (length > maxLength) {
      counter.className = 'char-counter char-counter--error';
    } else {
      counter.className = 'char-counter';
    }
  }
}