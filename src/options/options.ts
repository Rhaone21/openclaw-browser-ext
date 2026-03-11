/**
 * Options page script for OpenClaw Browser Extension
 */

import { getSettings, saveSettings, parsePort } from '../shared/utils.js';

// DOM Elements
const elements = {
  portInput: document.getElementById('port') as HTMLInputElement,
  tokenInput: document.getElementById('token') as HTMLInputElement,
  autoAttachInput: document.getElementById('autoAttach') as HTMLInputElement,
  saveButton: document.getElementById('save') as HTMLButtonElement,
  testButton: document.getElementById('test') as HTMLButtonElement,
  statusDiv: document.getElementById('status') as HTMLDivElement,
  connectionStatus: document.getElementById('connectionStatus') as HTMLParagraphElement,
  attachedTabs: document.getElementById('attachedTabs') as HTMLParagraphElement,
};

// Load settings on page load
async function loadSettings(): Promise<void> {
  try {
    const settings = await getSettings();
    
    elements.portInput.value = String(settings.relayPort);
    elements.tokenInput.value = settings.gatewayToken;
    elements.autoAttachInput.checked = settings.autoAttach;
    
    await updateStatus();
  } catch (error) {
    showStatus('error', 'Failed to load settings');
    console.error('Failed to load settings:', error);
  }
}

// Save settings
async function save(): Promise<void> {
  const port = parsePort(elements.portInput.value);
  const token = elements.tokenInput.value.trim();
  const autoAttach = elements.autoAttachInput.checked;
  
  if (!token) {
    showStatus('error', 'Gateway token is required');
    return;
  }
  
  try {
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = 'Saving...';
    
    await saveSettings({
      relayPort: port,
      gatewayToken: token,
      autoAttach,
    });
    
    // Update inputs with normalized values
    elements.portInput.value = String(port);
    
    showStatus('ok', 'Settings saved successfully');
    await updateStatus();
  } catch (error) {
    showStatus('error', 'Failed to save settings');
    console.error('Failed to save settings:', error);
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = 'Save Settings';
  }
}

// Test connection to relay
async function testConnection(): Promise<void> {
  try {
    elements.testButton.disabled = true;
    elements.testButton.textContent = 'Testing...';
    
    const response = await chrome.runtime.sendMessage({
      type: 'relayCheck',
    });
    
    if (response.success) {
      const { connected, port, hasToken } = response.data;
      
      if (!hasToken) {
        showStatus('error', 'Gateway token not configured');
      } else if (connected) {
        showStatus('ok', `Connected to relay on port ${port}`);
      } else {
        showStatus('error', `Cannot connect to relay on port ${port}. Make sure OpenClaw Gateway is running.`);
      }
    } else {
      showStatus('error', response.error || 'Connection test failed');
    }
  } catch (error) {
    showStatus('error', 'Failed to test connection');
    console.error('Failed to test connection:', error);
  } finally {
    elements.testButton.disabled = false;
    elements.testButton.textContent = 'Test Connection';
  }
}

// Update status display
async function updateStatus(): Promise<void> {
  try {
    // Get connection status
    const response = await chrome.runtime.sendMessage({
      type: 'relayCheck',
    });
    
    if (response.success) {
      const { connected, hasToken } = response.data;
      
      if (!hasToken) {
        elements.connectionStatus.textContent = 'Not configured - Please set gateway token';
        elements.connectionStatus.style.color = '#ef4444';
      } else if (connected) {
        elements.connectionStatus.textContent = 'Connected to OpenClaw Gateway';
        elements.connectionStatus.style.color = '#16a34a';
      } else {
        elements.connectionStatus.textContent = 'Disconnected - Check if Gateway is running';
        elements.connectionStatus.style.color = '#ef4444';
      }
    }
    
    // Get attached tabs
    const tabsResponse = await chrome.runtime.sendMessage({
      type: 'getAllTabs',
    });
    
    if (tabsResponse.success) {
      const tabs = tabsResponse.data;
      elements.attachedTabs.textContent = `Attached tabs: ${tabs.length}`;
    }
  } catch (error) {
    elements.connectionStatus.textContent = 'Status unknown';
    elements.attachedTabs.textContent = 'Attached tabs: unknown';
    console.error('Failed to update status:', error);
  }
}

// Show status message
function showStatus(kind: 'ok' | 'error' | 'info', message: string): void {
  elements.statusDiv.dataset.kind = kind;
  elements.statusDiv.textContent = message;
  
  // Clear status after 5 seconds if it's success
  if (kind === 'ok') {
    setTimeout(() => {
      elements.statusDiv.textContent = '';
      elements.statusDiv.removeAttribute('data-kind');
    }, 5000);
  }
}

// Event listeners
elements.saveButton.addEventListener('click', () => void save());
elements.testButton.addEventListener('click', () => void testConnection());

// Initialize
void loadSettings();
