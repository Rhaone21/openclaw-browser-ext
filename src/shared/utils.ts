/**
 * Shared utilities for OpenClaw Browser Extension
 */

import { DEFAULT_RELAY_PORT, DEFAULT_RELAY_HOST } from './constants.js';
import type { RelayConfig, ExtensionSettings } from './types.js';

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Parse and validate port number
 */
export function parsePort(value: unknown): number {
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 65535) {
    return DEFAULT_RELAY_PORT;
  }
  return num;
}

/**
 * Build WebSocket URL for relay connection
 */
export function buildRelayWsUrl(config: RelayConfig): string {
  const { host, port } = config;
  return `ws://${host}:${port}/ws`;
}

/**
 * Build HTTP URL for relay health check
 */
export function buildRelayHttpUrl(config: RelayConfig): string {
  const { host, port } = config;
  return `http://${host}:${port}/json/version`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}

/**
 * Derive relay token from gateway token
 * Uses HMAC-like approach with subtle crypto
 */
export async function deriveRelayToken(
  gatewayToken: string,
  port: number
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${gatewayToken}:${port}`);
  
  // Use SubtleCrypto if available (in background script context)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const keyData = encoder.encode(gatewayToken);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for contexts without crypto.subtle
  // Simple hash function for demo purposes
  let hash = 0;
  const str = `${gatewayToken}:${port}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Get extension settings from storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get([
    'relayHost',
    'relayPort',
    'gatewayToken',
    'autoAttach',
  ]);
  
  return {
    relayHost: String(stored.relayHost || DEFAULT_RELAY_HOST),
    relayPort: parsePort(stored.relayPort),
    gatewayToken: String(stored.gatewayToken || ''),
    autoAttach: Boolean(stored.autoAttach),
  };
}

/**
 * Save extension settings to storage
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    'network error',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'connection closed',
    'connection reset',
  ];
  
  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Format error for display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
