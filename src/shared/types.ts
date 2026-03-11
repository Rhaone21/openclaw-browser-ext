/**
 * Type definitions for OpenClaw Browser Extension
 */

export type BadgeState = 'ON' | 'OFF' | 'CONNECTING' | 'ERROR';

export type TabState = 'connecting' | 'connected' | 'detached' | 'error';

export interface AttachedTab {
  tabId: number;
  sessionId: string;
  targetId: string;
  url: string;
  title: string;
  state: TabState;
  attachedAt: number;
}

export interface RelayConfig {
  host: string;
  port: number;
  token: string;
}

export interface ExtensionSettings {
  relayHost: string;
  relayPort: number;
  gatewayToken: string;
  autoAttach: boolean;
}

// CDP Types
export interface CDPMessage {
  id?: number;
  method: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface CDPTarget {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  canAccessOpener: boolean;
  openerFrameId?: number;
  openerId?: string;
  browserContextId?: string;
  subtype?: string;
}

// Message types for internal communication
export interface AttachTabMessage {
  type: 'attachTab';
  tabId: number;
  sessionId?: string;
}

export interface DetachTabMessage {
  type: 'detachTab';
  tabId: number;
}

export interface GetTabStateMessage {
  type: 'getTabState';
  tabId: number;
}

export interface ToggleTabMessage {
  type: 'toggleTab';
  tabId: number;
}

export interface GetAllTabsMessage {
  type: 'getAllTabs';
}

export interface RelayCheckMessage {
  type: 'relayCheck';
  url: string;
  token: string;
}

export interface ElementPickedMessage {
  type: 'elementPicked';
  tabId: number;
  selector: string;
  elementData: {
    tagName: string;
    textContent: string;
    attributes: Record<string, string>;
    boundingRect: DOMRect;
  };
}

export type ExtensionMessage =
  | AttachTabMessage
  | DetachTabMessage
  | GetTabStateMessage
  | ToggleTabMessage
  | GetAllTabsMessage
  | RelayCheckMessage
  | ElementPickedMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
