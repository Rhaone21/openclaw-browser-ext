/**
 * Popup script for OpenClaw Browser Extension
 * Shows attached tabs and quick actions
 */

import type { AttachedTab, MessageResponse } from '../shared/types.js';

// DOM Elements
const elements = {
  tabList: document.getElementById('tabList') as HTMLDivElement,
  attachButton: document.getElementById('attachButton') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLDivElement,
};

// Current tab ID
let currentTabId: number | null = null;

// Initialize popup
async function initialize(): Promise<void> {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      currentTabId = tab.id;
    }
    
    await loadTabs();
    updateAttachButton();
  } catch (error) {
    showStatus('error', 'Failed to initialize popup');
    console.error('Failed to initialize popup:', error);
  }
}

// Load attached tabs
async function loadTabs(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getAllTabs',
    }) as MessageResponse<AttachedTab[]>;
    
    if (response.success && response.data) {
      renderTabList(response.data);
    } else {
      elements.tabList.innerHTML = '<p class="empty">No attached tabs</p>';
    }
  } catch (error) {
    elements.tabList.innerHTML = '<p class="error">Failed to load tabs</p>';
    console.error('Failed to load tabs:', error);
  }
}

// Render tab list
function renderTabList(tabs: AttachedTab[]): void {
  if (tabs.length === 0) {
    elements.tabList.innerHTML = '<p class="empty">No attached tabs</p>';
    return;
  }
  
  const html = tabs.map(tab => `
    <div class="tab-item ${tab.tabId === currentTabId ? 'current' : ''}" data-tab-id="${tab.tabId}">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.title)}</div>
        <div class="tab-url">${escapeHtml(truncateUrl(tab.url))}</div>
      </div>
      <div class="tab-status ${tab.state}">${tab.state}</div>
      <button class="detach-btn" data-tab-id="${tab.tabId}">Detach</button>
    </div>
  `).join('');
  
  elements.tabList.innerHTML = html;
  
  // Add event listeners to detach buttons
  document.querySelectorAll('.detach-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = parseInt((e.target as HTMLElement).dataset.tabId || '0', 10);
      if (tabId) {
        void detachTab(tabId);
      }
    });
  });
}

// Toggle current tab attachment
async function toggleCurrentTab(): Promise<void> {
  if (!currentTabId) {
    showStatus('error', 'No active tab');
    return;
  }
  
  try {
    elements.attachButton.disabled = true;
    
    const response = await chrome.runtime.sendMessage({
      type: 'toggleTab',
      tabId: currentTabId,
    }) as MessageResponse<{ attached: boolean }>;
    
    if (response.success) {
      const isAttached = response.data?.attached ?? false;
      showStatus('ok', isAttached ? 'Tab attached' : 'Tab detached');
      await loadTabs();
      updateAttachButton();
    } else {
      showStatus('error', response.error || 'Failed to toggle tab');
    }
  } catch (error) {
    showStatus('error', 'Failed to toggle tab');
    console.error('Failed to toggle tab:', error);
  } finally {
    elements.attachButton.disabled = false;
  }
}

// Detach a specific tab
async function detachTab(tabId: number): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'toggleTab',
      tabId,
    }) as MessageResponse<{ attached: boolean }>;
    
    if (response.success) {
      showStatus('ok', 'Tab detached');
      await loadTabs();
      if (tabId === currentTabId) {
        updateAttachButton();
      }
    } else {
      showStatus('error', response.error || 'Failed to detach tab');
    }
  } catch (error) {
    showStatus('error', 'Failed to detach tab');
    console.error('Failed to detach tab:', error);
  }
}

// Update attach button state
async function updateAttachButton(): Promise<void> {
  if (!currentTabId) {
    elements.attachButton.textContent = 'Attach';
    elements.attachButton.disabled = true;
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getTabState',
      tabId: currentTabId,
    }) as MessageResponse<AttachedTab>;
    
    const isAttached = response.success && response.data?.state === 'connected';
    elements.attachButton.textContent = isAttached ? 'Detach' : 'Attach';
    elements.attachButton.disabled = false;
  } catch (error) {
    elements.attachButton.textContent = 'Attach';
    elements.attachButton.disabled = false;
    console.error('Failed to get tab state:', error);
  }
}

// Show status message
function showStatus(kind: 'ok' | 'error' | 'info', message: string): void {
  elements.status.dataset.kind = kind;
  elements.status.textContent = message;
  
  setTimeout(() => {
    elements.status.textContent = '';
    elements.status.removeAttribute('data-kind');
  }, 3000);
}

// Utility: Escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Truncate URL
function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

// Event listeners
elements.attachButton.addEventListener('click', () => void toggleCurrentTab());

// Initialize
void initialize();
