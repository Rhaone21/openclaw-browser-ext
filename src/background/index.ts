/**
 * Background service worker for OpenClaw Browser Extension
 * Main entry point for extension background functionality
 */

import { getRelayConnection } from './relay-connection.js';
import { getTabManager } from './tab-manager.js';
import { getBadgeManager } from './badge-manager.js';
import { getSettings } from '../shared/utils.js';
import type { CDPMessage, ExtensionMessage, MessageResponse } from '../shared/types.js';

// Initialize on startup
async function initialize(): Promise<void> {
  console.log('[OpenClaw] Background service worker starting...');

  const settings = await getSettings();
  const relay = getRelayConnection();
  const tabManager = getTabManager();
  const badgeManager = getBadgeManager();

  // Set up relay callbacks
  relay.setCallbacks({
    onOpen: () => {
      console.log('[OpenClaw] Relay connected');
      badgeManager.setGlobalBadge('ON');
    },
    onClose: (wasClean) => {
      console.log('[OpenClaw] Relay disconnected', wasClean ? 'cleanly' : 'unexpectedly');
      if (!wasClean) {
        badgeManager.setGlobalBadge('ERROR');
      } else {
        badgeManager.setGlobalBadge('OFF');
      }
    },
    onError: (error) => {
      console.error('[OpenClaw] Relay error:', error);
      badgeManager.setGlobalBadge('ERROR');
    },
    onMessage: (message: CDPMessage) => {
      handleCDPMessage(message);
    },
  });

  // Connect to relay if token is set
  if (settings.gatewayToken) {
    await relay.initialize(settings.gatewayToken, settings.relayPort);
  } else {
    console.log('[OpenClaw] No gateway token set, waiting for configuration');
    await badgeManager.setGlobalBadge('ERROR');
  }

  // Rehydrate tab state
  await tabManager.rehydrateState();

  console.log('[OpenClaw] Background service worker initialized');
}

// Handle CDP messages from relay
function handleCDPMessage(message: CDPMessage): void {
  // Route messages to appropriate tab/session
  if (message.id !== undefined) {
    // This is a response to a previous command
    // Could be handled here or by the original caller
  }

  // Handle events
  if (message.method?.startsWith('Target.')) {
    // Target-related events
    console.log('[OpenClaw] Target event:', message.method, message.params);
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const tabManager = getTabManager();
  const badgeManager = getBadgeManager();

  try {
    const isAttached = await tabManager.toggleTab(tab.id);
    await badgeManager.setBadge(tab.id, isAttached ? 'ON' : 'OFF');
  } catch (error) {
    console.error('[OpenClaw] Failed to toggle tab:', error);
    await badgeManager.setBadge(tab.id, 'ERROR');
  }
});

// Handle tab navigation
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only handle main frame

  const tabManager = getTabManager();
  await tabManager.handleNavigation(details.tabId, details.url);
});

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabManager = getTabManager();
  await tabManager.handleTabRemoved(tabId);
});

// Handle tab updates (title changes, etc.)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  const tabManager = getTabManager();
  const attachedTab = tabManager.getTab(tabId);
  
  if (attachedTab && changeInfo.title) {
    attachedTab.title = changeInfo.title;
  }
  if (attachedTab && changeInfo.url) {
    attachedTab.url = changeInfo.url;
  }
});

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender,
  sendResponse: (response: MessageResponse) => void
) => {
  void handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  const tabManager = getTabManager();
  const relay = getRelayConnection();

  try {
    switch (message.type) {
      case 'getAllTabs': {
        const tabs = tabManager.getAllTabs();
        sendResponse({ success: true, data: tabs });
        break;
      }

      case 'toggleTab': {
        if (!message.tabId) {
          sendResponse({ success: false, error: 'tabId required' });
          return;
        }
        const isAttached = await tabManager.toggleTab(message.tabId);
        sendResponse({ success: true, data: { attached: isAttached } });
        break;
      }

      case 'getTabState': {
        if (!message.tabId) {
          sendResponse({ success: false, error: 'tabId required' });
          return;
        }
        const tab = tabManager.getTab(message.tabId);
        sendResponse({ success: true, data: tab });
        break;
      }

      case 'relayCheck': {
        // Check if relay is reachable
        const settings = await getSettings();
        const isConnected = relay.isConnected();
        sendResponse({
          success: true,
          data: {
            connected: isConnected,
            port: settings.relayPort,
            hasToken: !!settings.gatewayToken,
          },
        });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendResponse({ success: false, error: errorMessage });
  }
}

// Handle storage changes (settings updated)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;

  const relay = getRelayConnection();

  // If gateway token changed, reinitialize connection
  if (changes.gatewayToken) {
    const newToken = changes.gatewayToken.newValue as string;
    const settings = await getSettings();
    
    if (newToken) {
      relay.disconnect();
      await relay.initialize(newToken, settings.relayPort);
    } else {
      relay.disconnect();
    }
  }

  // If port changed, reconnect with new port
  if (changes.relayPort) {
    const settings = await getSettings();
    if (settings.gatewayToken) {
      relay.disconnect();
      await relay.initialize(settings.gatewayToken, settings.relayPort);
    }
  }
});

// Initialize on startup
void initialize();

// Re-initialize on service worker restart (MV3)
chrome.runtime.onStartup.addListener(() => {
  void initialize();
});

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});
