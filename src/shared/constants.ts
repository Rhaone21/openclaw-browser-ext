/**
 * Shared constants for OpenClaw Browser Extension
 */

export const DEFAULT_RELAY_PORT = 18792;
export const DEFAULT_RELAY_HOST = '127.0.0.1';
export const RELAY_WS_PATH = '/ws';

export const STORAGE_KEYS = {
  RELAY_HOST: 'relayHost',
  RELAY_PORT: 'relayPort',
  GATEWAY_TOKEN: 'gatewayToken',
  AUTO_ATTACH: 'autoAttach',
  ATTACHED_TABS: 'attachedTabs',
  SESSION_COUNTER: 'sessionCounter',
} as const;

export const BADGE_STATES = {
  ON: { text: 'ON', color: '#FF5A36' },
  OFF: { text: '', color: '#000000' },
  CONNECTING: { text: '…', color: '#F59E0B' },
  ERROR: { text: '!', color: '#B91C1C' },
} as const;

export const MESSAGE_TYPES = {
  // Background <-> Content
  ATTACH_TAB: 'attachTab',
  DETACH_TAB: 'detachTab',
  GET_TAB_STATE: 'getTabState',
  
  // Background <-> Popup
  GET_ALL_TABS: 'getAllTabs',
  TOGGLE_TAB: 'toggleTab',
  
  // Background <-> Options
  RELAY_CHECK: 'relayCheck',
  
  // Content -> Background
  ELEMENT_PICKED: 'elementPicked',
  ACTION_RECORDED: 'actionRecorded',
} as const;

export const CDP_METHODS = {
  ATTACH: 'Target.attachToTarget',
  DETACH: 'Target.detachFromTarget',
  SEND_MESSAGE: 'Target.sendMessageToTarget',
  CREATE_TARGET: 'Target.createTarget',
  CLOSE_TARGET: 'Target.closeTarget',
  GET_TARGETS: 'Target.getTargets',
} as const;

export const RECONNECT = {
  MAX_ATTEMPTS: 10,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
} as const;
