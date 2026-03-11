/**
 * Badge manager for background script
 * Handles extension icon badge state
 */

import { BADGE_STATES } from '../shared/constants.js';
import type { BadgeState } from '../shared/types.js';

export class BadgeManager {
  /**
   * Set badge for a specific tab
   */
  async setBadge(tabId: number, state: BadgeState): Promise<void> {
    const config = BADGE_STATES[state];
    
    try {
      await chrome.action.setBadgeText({ tabId, text: config.text });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: config.color });
      await chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' });
    } catch (error) {
      console.error('Failed to set badge:', error);
    }
  }

  /**
   * Clear badge for a specific tab
   */
  async clearBadge(tabId: number): Promise<void> {
    try {
      await chrome.action.setBadgeText({ tabId, text: '' });
    } catch (error) {
      console.error('Failed to clear badge:', error);
    }
  }

  /**
   * Set global badge (when no tab specified)
   */
  async setGlobalBadge(state: BadgeState): Promise<void> {
    const config = BADGE_STATES[state];
    
    try {
      await chrome.action.setBadgeText({ text: config.text });
      await chrome.action.setBadgeBackgroundColor({ color: config.color });
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    } catch (error) {
      console.error('Failed to set global badge:', error);
    }
  }

  /**
   * Clear global badge
   */
  async clearGlobalBadge(): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text: '' });
    } catch (error) {
      console.error('Failed to clear global badge:', error);
    }
  }

  /**
   * Update badge based on connection state
   */
  async updateConnectionBadge(
    tabId: number | null,
    connected: boolean,
    hasError: boolean
  ): Promise<void> {
    let state: BadgeState;
    
    if (hasError) {
      state = 'ERROR';
    } else if (connected) {
      state = 'ON';
    } else {
      state = 'OFF';
    }

    if (tabId !== null) {
      await this.setBadge(tabId, state);
    } else {
      await this.setGlobalBadge(state);
    }
  }
}

// Singleton instance
let badgeManager: BadgeManager | null = null;

export function getBadgeManager(): BadgeManager {
  if (!badgeManager) {
    badgeManager = new BadgeManager();
  }
  return badgeManager;
}
