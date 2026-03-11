/**
 * Tab manager for background script
 * Handles tab attachment, detachment, and state management
 */

import type { AttachedTab } from '../shared/types.js';
import { getRelayConnection } from './relay-connection.js';
import { generateSessionId } from '../shared/utils.js';

export class TabManager {
  private tabs = new Map<number, AttachedTab>();
  private tabBySession = new Map<string, number>();
  private operationLocks = new Set<number>();
  private reattachPending = new Set<number>();
  private nextSession = 1;

  /**
   * Get all attached tabs
   */
  getAllTabs(): AttachedTab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get tab by ID
   */
  getTab(tabId: number): AttachedTab | undefined {
    return this.tabs.get(tabId);
  }

  /**
   * Get tab by session ID
   */
  getTabBySession(sessionId: string): AttachedTab | undefined {
    const tabId = this.tabBySession.get(sessionId);
    if (tabId !== undefined) {
      return this.tabs.get(tabId);
    }
    return undefined;
  }

  /**
   * Check if tab is attached
   */
  isAttached(tabId: number): boolean {
    const tab = this.tabs.get(tabId);
    return tab !== undefined && tab.state === 'connected';
  }

  /**
   * Check if tab operation is locked
   */
  isLocked(tabId: number): boolean {
    return this.operationLocks.has(tabId);
  }

  /**
   * Attach to a tab
   */
  async attachTab(tabId: number): Promise<AttachedTab> {
    // Check if already attached
    if (this.isAttached(tabId)) {
      const existing = this.tabs.get(tabId);
      if (existing) return existing;
    }

    // Check lock
    if (this.isLocked(tabId)) {
      throw new Error(`Tab ${tabId} is currently being modified`);
    }

    // Acquire lock
    this.operationLocks.add(tabId);

    try {
      // Get tab info
      const tab = await chrome.tabs.get(tabId);
      if (!tab.id || !tab.url) {
        throw new Error('Invalid tab');
      }

      // Create session
      const sessionId = generateSessionId();
      const targetId = `target-${this.nextSession++}`;

      // Create attached tab record
      const attachedTab: AttachedTab = {
        tabId: tab.id,
        sessionId,
        targetId,
        url: tab.url,
        title: tab.title || 'Untitled',
        state: 'connecting',
        attachedAt: Date.now(),
      };

      // Store in maps
      this.tabs.set(tabId, attachedTab);
      this.tabBySession.set(sessionId, tabId);

      // Connect to CDP
      await this.connectToCDP(tabId, sessionId, targetId);

      // Update state
      attachedTab.state = 'connected';
      this.tabs.set(tabId, attachedTab);

      // Notify content script
      await this.notifyContentScript(tabId, 'attached', sessionId);

      // Persist state
      await this.persistState();

      return attachedTab;
    } finally {
      // Release lock
      this.operationLocks.delete(tabId);
    }
  }

  /**
   * Detach from a tab
   */
  async detachTab(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return; // Not attached, nothing to do
    }

    // Check lock
    if (this.isLocked(tabId)) {
      throw new Error(`Tab ${tabId} is currently being modified`);
    }

    // Acquire lock
    this.operationLocks.add(tabId);

    try {
      // Disconnect from CDP
      await this.disconnectFromCDP(tab.sessionId);

      // Remove from maps
      this.tabs.delete(tabId);
      this.tabBySession.delete(tab.sessionId);

      // Notify content script
      await this.notifyContentScript(tabId, 'detached');

      // Persist state
      await this.persistState();
    } finally {
      // Release lock
      this.operationLocks.delete(tabId);
    }
  }

  /**
   * Toggle tab attachment
   */
  async toggleTab(tabId: number): Promise<boolean> {
    if (this.isAttached(tabId)) {
      await this.detachTab(tabId);
      return false;
    } else {
      await this.attachTab(tabId);
      return true;
    }
  }

  /**
   * Handle tab navigation
   */
  async handleNavigation(tabId: number, url: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab || tab.state !== 'connected') {
      return;
    }

    // Mark as pending reattach
    this.reattachPending.add(tabId);
    tab.state = 'connecting';
    tab.url = url;

    try {
      // Reconnect to CDP
      await this.disconnectFromCDP(tab.sessionId);
      await this.connectToCDP(tabId, tab.sessionId, tab.targetId);

      tab.state = 'connected';
      this.tabs.set(tabId, tab);

      // Notify content script
      await this.notifyContentScript(tabId, 'reattached', tab.sessionId);
    } catch (error) {
      tab.state = 'error';
      this.tabs.set(tabId, tab);
      console.error('Failed to reattach after navigation:', error);
    } finally {
      this.reattachPending.delete(tabId);
    }
  }

  /**
   * Handle tab removal
   */
  async handleTabRemoved(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return;
    }

    // Clean up without notifying (tab is gone)
    await this.disconnectFromCDP(tab.sessionId);
    this.tabs.delete(tabId);
    this.tabBySession.delete(tab.sessionId);
    await this.persistState();
  }

  /**
   * Rehydrate state from storage
   */
  async rehydrateState(): Promise<void> {
    try {
      const stored = await chrome.storage.session.get(['persistedTabs', 'nextSession']);
      
      if (stored.nextSession) {
        this.nextSession = Math.max(this.nextSession, stored.nextSession as number);
      }

      const entries = (stored.persistedTabs || []) as Array<{
        tabId: number;
        sessionId: string;
        targetId: string;
        attachOrder?: number;
      }>;

      // Check which tabs still exist
      const existingTabs = await chrome.tabs.query({});
      const existingTabIds = new Set(existingTabs.map(t => t.id));

      for (const entry of entries) {
        if (existingTabIds.has(entry.tabId)) {
          // Restore tab record
          const tab: AttachedTab = {
            tabId: entry.tabId,
            sessionId: entry.sessionId,
            targetId: entry.targetId,
            url: '',
            title: 'Restored',
            state: 'connecting',
            attachedAt: Date.now(),
          };

          this.tabs.set(entry.tabId, tab);
          this.tabBySession.set(entry.sessionId, entry.tabId);

          // Try to reattach
          void this.reattachTab(entry.tabId);
        }
      }
    } catch (error) {
      console.error('Failed to rehydrate state:', error);
    }
  }

  /**
   * Clear all attached tabs
   */
  async clearAll(): Promise<void> {
    const tabIds = Array.from(this.tabs.keys());
    for (const tabId of tabIds) {
      await this.detachTab(tabId);
    }
  }

  /**
   * Connect to CDP
   */
  private async connectToCDP(
    tabId: number,
    _sessionId: string,
    _targetId: string
  ): Promise<void> {
    const relay = getRelayConnection();
    
    if (!relay.isConnected()) {
      throw new Error('Relay not connected');
    }

    // Send attach message to relay
    relay.send({
      method: 'Target.attachToTarget',
      params: {
        targetId: String(tabId),
        flatten: true,
      },
    });
  }

  /**
   * Disconnect from CDP
   */
  private async disconnectFromCDP(sessionId: string): Promise<void> {
    const relay = getRelayConnection();
    
    if (!relay.isConnected()) {
      return;
    }

    relay.send({
      method: 'Target.detachFromTarget',
      params: {
        sessionId,
      },
    });
  }

  /**
   * Notify content script
   */
  private async notifyContentScript(
    tabId: number,
    event: 'attached' | 'detached' | 'reattached',
    sessionId?: string
  ): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: event === 'attached' ? 'attachTab' : event === 'detached' ? 'detachTab' : 'getTabState',
        sessionId,
      });
    } catch {
      // Content script might not be injected, that's ok
    }
  }

  /**
   * Reattach to a tab (used during rehydration)
   */
  private async reattachTab(tabId: number): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    try {
      // Get current tab info
      const chromeTab = await chrome.tabs.get(tabId);
      tab.url = chromeTab.url || '';
      tab.title = chromeTab.title || 'Untitled';

      // Connect to CDP
      await this.connectToCDP(tabId, tab.sessionId, tab.targetId);
      tab.state = 'connected';
      
      // Notify content script
      await this.notifyContentScript(tabId, 'reattached', tab.sessionId);
    } catch (error) {
      tab.state = 'error';
      console.error('Failed to reattach tab:', error);
    }

    this.tabs.set(tabId, tab);
    await this.persistState();
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      const tabEntries = [];
      for (const [tabId, tab] of this.tabs) {
        if (tab.state === 'connected' || tab.state === 'connecting') {
          tabEntries.push({
            tabId,
            sessionId: tab.sessionId,
            targetId: tab.targetId,
            attachOrder: tab.attachedAt,
          });
        }
      }

      await chrome.storage.session.set({
        persistedTabs: tabEntries,
        nextSession: this.nextSession,
      });
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }
}

// Singleton instance
let tabManager: TabManager | null = null;

export function getTabManager(): TabManager {
  if (!tabManager) {
    tabManager = new TabManager();
  }
  return tabManager;
}

export function resetTabManager(): void {
  tabManager = null;
}
