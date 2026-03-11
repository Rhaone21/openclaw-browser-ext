/**
 * Content script for OpenClaw Browser Extension
 * Injected into web pages to communicate with background script
 */

import type { ExtensionMessage, MessageResponse } from '../shared/types.js';

interface ContentState {
  attached: boolean;
  sessionId: string | null;
  elementPickerActive: boolean;
}

const state: ContentState = {
  attached: false,
  sessionId: null,
  elementPickerActive: false,
};

// Initialize content script
function initialize(): void {
  console.log('[OpenClaw] Content script initialized');

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);

  // Notify background script that content script is ready
  notifyBackground('contentReady');
}

// Handle messages from background script
function handleBackgroundMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean {
  console.log('[OpenClaw] Received message:', message);

  switch (message.type) {
    case 'attachTab':
      state.attached = true;
      state.sessionId = message.sessionId || null;
      sendResponse({ success: true });
      break;

    case 'detachTab':
      state.attached = false;
      state.sessionId = null;
      sendResponse({ success: true });
      break;

    case 'getTabState':
      sendResponse({
        success: true,
        data: {
          attached: state.attached,
          sessionId: state.sessionId,
        },
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
}

// Send message to background script
async function notifyBackground(type: string, data?: Record<string, unknown>): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type, ...data });
  } catch (error) {
    console.error('[OpenClaw] Failed to notify background:', error);
  }
}

// Initialize
initialize();
