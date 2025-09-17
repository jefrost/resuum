/**
 * Bullet editor modal coordinator
 */

import { BulletFormBuilder } from './bullet-form-builder';
import { getBulletDataService } from './bullet-data-service';
import { createSafeElement } from './xss-safe-rendering';

export class BulletEditor {
  private modal: HTMLElement | null = null;
  private formBuilder: BulletFormBuilder;

  constructor() {
    this.formBuilder = new BulletFormBuilder();
  }

  async showAddModal(defaultRoleId?: string, defaultProjectId?: string, onSave?: () => void): Promise<void> {
    await this.showModal({
      title: 'Add Bullet Point',
      bullet: null,
      ...(defaultRoleId && { defaultRoleId }),
      ...(defaultProjectId && { defaultProjectId })
    }, false, onSave);
  }

  async showEditModal(bulletId: string, onSave?: () => void): Promise<void> {
    const dataService = getBulletDataService();
    const bullets = await dataService.getAllBullets();
    const bullet = bullets.find(b => b.id === bulletId);
    
    if (!bullet) throw new Error('Bullet not found');
    
    await this.showModal({
      title: 'Edit Bullet Point',
      bullet,
      defaultRoleId: bullet.roleId,
      defaultProjectId: bullet.projectId
    }, true, onSave);
  }

  private async showModal(config: any, isEdit: boolean, onSave?: () => void): Promise<void> {
    this.hideModal();
    
    this.modal = this.createModalStructure(config.title);
    const form = await this.formBuilder.createForm(config, isEdit, 
      (data) => this.handleSubmit(data, isEdit, config.bullet?.id, onSave),
      () => this.hideModal()
    );
    
    this.modal.querySelector('.modal-body')!.appendChild(form);
    this.showModalElement();
  }

  private createModalStructure(title: string): HTMLElement {
    const modal = createSafeElement('div', '', 'modal-overlay');
    const content = createSafeElement('div', '', 'modal-content bullet-editor-modal');
    const header = createSafeElement('div', '', 'modal-header');
    const titleEl = createSafeElement('h3', title);
    const closeBtn = createSafeElement('button', '×', 'modal-close');
    const body = createSafeElement('div', '', 'modal-body');
    
    closeBtn.onclick = () => this.hideModal();
    header.append(titleEl, closeBtn);
    content.append(header, body);
    modal.appendChild(content);
    
    return modal;
  }

  private showModalElement(): void {
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(this.modal!);
    
    // Focus first input
    setTimeout(() => {
      const firstInput = this.modal!.querySelector('input, textarea') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
  }

  private async handleSubmit(data: any, isEdit: boolean, bulletId?: string, onSave?: () => void): Promise<void> {
    try {
      const dataService = getBulletDataService();
      
      if (isEdit && bulletId) {
        await dataService.updateBullet(bulletId, {
          text: data.text,
          projectId: data.projectId
        });
      } else {
        await dataService.createBullet({
          roleId: data.roleId,
          projectId: data.projectId,
          text: data.text,
          source: 'manual'
        });
      }
      
      this.hideModal();
      
      if (onSave) {
        onSave();
      }
      
    } catch (error) {
      console.error('Failed to save bullet:', error);
      alert('Failed to save bullet point');
    }
  }

  private hideModal(): void {
    this.modal?.remove();
    this.modal = null;
  }
}

// ============================================================================
// Global Editor Instance
// ============================================================================

let globalBulletEditor: BulletEditor | null = null;

export function getBulletEditor(): BulletEditor {
  if (!globalBulletEditor) {
    globalBulletEditor = new BulletEditor();
  }
  return globalBulletEditor;
}