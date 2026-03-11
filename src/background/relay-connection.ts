/**
 * Relay connection manager for background script
 * Handles WebSocket connection to OpenClaw Gateway
 */

import {
  buildRelayWsUrl,
  deriveRelayToken,
  calculateBackoffDelay,
  formatError,
} from '../shared/utils.js';
import {
  RECONNECT,
  DEFAULT_RELAY_PORT,
  DEFAULT_RELAY_HOST,
} from '../shared/constants.js';
import type { RelayConfig, CDPMessage } from '../shared/types.js';

interface ConnectionState {
  ws: WebSocket | null;
  isConnecting: boolean;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  gatewayToken: string;
  port: number;
}

interface MessageHandler {
  (message: CDPMessage): void;
}

interface ConnectionCallbacks {
  onOpen: () => void;
  onClose: (wasClean: boolean) => void;
  onError: (error: Error) => void;
  onMessage: MessageHandler;
}

export class RelayConnection {
  private state: ConnectionState = {
    ws: null,
    isConnecting: false,
    reconnectAttempt: 0,
    reconnectTimer: null,
    gatewayToken: '',
    port: DEFAULT_RELAY_PORT,
  };

  private callbacks: ConnectionCallbacks | null = null;
  private messageQueue: CDPMessage[] = [];

  /**
   * Initialize connection with gateway token
   */
  async initialize(gatewayToken: string, port: number = DEFAULT_RELAY_PORT): Promise<void> {
    this.state.gatewayToken = gatewayToken;
    this.state.port = port;
    await this.connect();
  }

  /**
   * Set connection callbacks
   */
  setCallbacks(callbacks: ConnectionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Connect to relay server
   */
  async connect(): Promise<void> {
    if (this.state.isConnecting || this.state.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.state.isConnecting = true;

    try {
      const config: RelayConfig = {
        host: DEFAULT_RELAY_HOST,
        port: this.state.port,
        token: this.state.gatewayToken,
      };

      const relayToken = await deriveRelayToken(this.state.gatewayToken, this.state.port);
      const wsUrl = `${buildRelayWsUrl(config)}?token=${encodeURIComponent(relayToken)}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.state.isConnecting = false;
        this.state.reconnectAttempt = 0;
        this.flushMessageQueue();
        this.callbacks?.onOpen();
      };

      ws.onclose = (event) => {
        this.state.ws = null;
        this.state.isConnecting = false;
        this.callbacks?.onClose(event.wasClean);
        
        if (!event.wasClean) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (_event) => {
        const error = new Error('WebSocket error');
        this.callbacks?.onError(error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as CDPMessage;
          this.callbacks?.onMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      this.state.ws = ws;
    } catch (error) {
      this.state.isConnecting = false;
      this.callbacks?.onError(error instanceof Error ? error : new Error(formatError(error)));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from relay server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    
    if (this.state.ws) {
      // Close cleanly
      this.state.ws.close(1000, 'Extension disconnecting');
      this.state.ws = null;
    }
    
    this.state.isConnecting = false;
    this.state.reconnectAttempt = 0;
  }

  /**
   * Send message to relay
   */
  send(message: CDPMessage): boolean {
    if (this.state.ws?.readyState === WebSocket.OPEN) {
      try {
        this.state.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        this.messageQueue.push(message);
        return false;
      }
    } else {
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; connecting: boolean; reconnectAttempt: number } {
    return {
      connected: this.isConnected(),
      connecting: this.state.isConnecting,
      reconnectAttempt: this.state.reconnectAttempt,
    };
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempt >= RECONNECT.MAX_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.clearReconnectTimer();

    const delay = calculateBackoffDelay(
      this.state.reconnectAttempt,
      RECONNECT.INITIAL_DELAY_MS,
      RECONNECT.MAX_DELAY_MS,
      RECONNECT.BACKOFF_MULTIPLIER
    );

    this.state.reconnectTimer = setTimeout(() => {
      this.state.reconnectAttempt++;
      void this.connect();
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.state.reconnectTimer) {
      clearTimeout(this.state.reconnectTimer);
      this.state.reconnectTimer = null;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
}

// Singleton instance
let relayConnection: RelayConnection | null = null;

export function getRelayConnection(): RelayConnection {
  if (!relayConnection) {
    relayConnection = new RelayConnection();
  }
  return relayConnection;
}

export function resetRelayConnection(): void {
  if (relayConnection) {
    relayConnection.disconnect();
    relayConnection = null;
  }
}
