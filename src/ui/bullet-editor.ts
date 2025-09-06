/**
 * Bullet editor modal coordinator (50 lines)
 */

import { BulletFormBuilder } from './bullet-form-builder';
import { BulletDataService } from './bullet-data-service';
import { createSafeElement } from './xss-safe-rendering';

export class BulletEditor {
  private modal: HTMLElement | null = null;
  private formBuilder: BulletFormBuilder;
  private dataService: BulletDataService;

  constructor() {
    this.formBuilder = new BulletFormBuilder();
    this.dataService = new BulletDataService();
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
    const bullet = await this.dataService.getBullet(bulletId);
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
    
    // Debug: Check if modal is properly added
    console.log('Modal added to:', mainContent);
    console.log('Modal in DOM:', document.contains(this.modal!));
    
    // Check if inputs are accessible
    const textInput = this.modal!.querySelector('#bullet-text') as HTMLTextAreaElement;
    console.log('Text input found:', textInput);
    console.log('Text input disabled:', textInput.disabled);
    
    // Try to focus programmatically
    setTimeout(() => {
      textInput.focus();
      console.log('Focused on text input');
    }, 100);
  }

  private async handleSubmit(data: any, isEdit: boolean, bulletId?: string, onSave?: () => void): Promise<void> {
    try {
      if (isEdit && bulletId) {
        await this.dataService.updateBullet(bulletId, data);
      } else {
        await this.dataService.createBullet(data);
      }
      this.hideModal();
      onSave?.();
    } catch (error) {
      alert('Failed to save bullet point');
    }
  }

  private hideModal(): void {
    this.modal?.remove();
    this.modal = null;
    document.onkeydown = null;
  }
}

let globalBulletEditor: BulletEditor | null = null;
export function getBulletEditor(): BulletEditor {
  if (!globalBulletEditor) globalBulletEditor = new BulletEditor();
  return globalBulletEditor;
}