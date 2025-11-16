import { useEffect, useRef, useCallback, useState } from 'react';
import { useLayyrrStore } from '../store';
import { WS_ENDPOINTS, TIMING } from '../utils/constants';
import type { WSReloadMessage, WSBatchCompleteMessage } from '../types';

/**
 * Connection status type for WebSocket connections
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/**
 * WebSocket connection state for each endpoint
 */
interface WebSocketState {
  status: ConnectionStatus;
  reconnectAttempts: number;
  reconnectDelay: number;
}

/**
 * Return type for the useWebSocket hook
 */
export interface UseWebSocketReturn {
  reloadStatus: ConnectionStatus;
  messageStatus: ConnectionStatus;
  sendReloadMessage: (message: WSReloadMessage) => void;
  sendMessageBatch: (message: WSBatchCompleteMessage) => void;
  isConnected: boolean;
}

/**
 * Custom React hook for managing WebSocket connections for reload and message endpoints.
 *
 * Features:
 * - Manages two separate WebSocket connections (reload and message)
 * - Auto-reconnects on disconnect with exponential backoff
 * - Handles incoming messages and dispatches to Zustand store
 * - Provides connection status and send methods for both endpoints
 * - Cleans up connections on unmount
 *
 * @returns {UseWebSocketReturn} Object containing connection statuses and send methods
 *
 * @example
 * ```tsx
 * const { reloadStatus, messageStatus, isConnected } = useWebSocket();
 *
 * return (
 *   <div>
 *     <p>Reload: {reloadStatus}</p>
 *     <p>Message: {messageStatus}</p>
 *   </div>
 * );
 * ```
 */
function useWebSocket(): UseWebSocketReturn {
  // State management
  const [reloadWsState, setReloadWsState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    reconnectDelay: TIMING.WS_RECONNECT_DELAY,
  });

  const [messageWsState, setMessageWsState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    reconnectDelay: TIMING.WS_RECONNECT_DELAY,
  });

  // Store references to WebSocket connections and timers
  const reloadWsRef = useRef<WebSocket | null>(null);
  const messageWsRef = useRef<WebSocket | null>(null);
  const reloadReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get store actions
  const { showStatus, resolveBatch } = useLayyrrStore();

  /**
   * Calculate exponential backoff delay with jitter
   * @param attempt Current reconnection attempt number
   * @param baseDelay Base delay in milliseconds
   * @returns Calculated delay in milliseconds
   */
  const calculateBackoffDelay = useCallback((attempt: number, baseDelay: number): number => {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
    const jitter = Math.random() * 1000; // Random 0-1000ms
    return exponentialDelay + jitter;
  }, []);

  /**
   * Handle incoming reload WebSocket message
   * @param data Parsed message data
   */
  const handleReloadMessage = useCallback((data: WSReloadMessage) => {
    if (data.type === 'reload') {
      showStatus('Reloading page...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, TIMING.RELOAD_DELAY);
    }
  }, [showStatus]);

  /**
   * Handle incoming message WebSocket message
   * @param data Parsed message data
   */
  const handleMessageData = useCallback((data: WSBatchCompleteMessage) => {
    if (data.type === 'batch_complete') {
      const { batch_number, message_id } = data;
      showStatus(`Batch ${batch_number} completed`, 'success', 2000);
      resolveBatch(batch_number, { message_id, batch_number });
    }
  }, [showStatus, resolveBatch]);

  /**
   * Connect to reload WebSocket endpoint
   */
  const connectReloadWs = useCallback(() => {
    if (reloadWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setReloadWsState((prev) => ({ ...prev, status: 'connecting' }));

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${WS_ENDPOINTS.RELOAD_PATH}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setReloadWsState({
          status: 'connected',
          reconnectAttempts: 0,
          reconnectDelay: TIMING.WS_RECONNECT_DELAY,
        });
        showStatus('Reload connection established', 'success', 1500);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSReloadMessage;
          handleReloadMessage(data);
        } catch (error) {
          console.error('Failed to parse reload message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Reload WebSocket error:', error);
        setReloadWsState((prev) => ({ ...prev, status: 'disconnected' }));
      };

      ws.onclose = () => {
        setReloadWsState((prev) => ({ ...prev, status: 'disconnected' }));

        // Schedule reconnect with exponential backoff
        setReloadWsState((prev) => {
          const delay = calculateBackoffDelay(prev.reconnectAttempts, TIMING.WS_RECONNECT_DELAY);

          if (reloadReconnectTimerRef.current) {
            clearTimeout(reloadReconnectTimerRef.current);
          }

          reloadReconnectTimerRef.current = setTimeout(() => {
            setReloadWsState((s) => ({
              ...s,
              status: 'reconnecting',
              reconnectAttempts: s.reconnectAttempts + 1,
            }));
            connectReloadWs();
          }, delay);

          return {
            ...prev,
            status: 'reconnecting',
            reconnectDelay: delay,
            reconnectAttempts: prev.reconnectAttempts + 1,
          };
        });
      };

      reloadWsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to reload WebSocket:', error);
      setReloadWsState((prev) => ({ ...prev, status: 'disconnected' }));
    }
  }, [calculateBackoffDelay, handleReloadMessage, showStatus]);

  /**
   * Connect to message WebSocket endpoint
   */
  const connectMessageWs = useCallback(() => {
    if (messageWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setMessageWsState((prev) => ({ ...prev, status: 'connecting' }));

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${WS_ENDPOINTS.MESSAGE_PATH}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setMessageWsState({
          status: 'connected',
          reconnectAttempts: 0,
          reconnectDelay: TIMING.WS_RECONNECT_DELAY,
        });
        showStatus('Message connection established', 'success', 1500);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSBatchCompleteMessage;
          handleMessageData(data);
        } catch (error) {
          console.error('Failed to parse message WebSocket data:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Message WebSocket error:', error);
        setMessageWsState((prev) => ({ ...prev, status: 'disconnected' }));
      };

      ws.onclose = () => {
        setMessageWsState((prev) => ({ ...prev, status: 'disconnected' }));

        // Schedule reconnect with exponential backoff
        setMessageWsState((prev) => {
          const delay = calculateBackoffDelay(prev.reconnectAttempts, TIMING.WS_RECONNECT_DELAY);

          if (messageReconnectTimerRef.current) {
            clearTimeout(messageReconnectTimerRef.current);
          }

          messageReconnectTimerRef.current = setTimeout(() => {
            setMessageWsState((s) => ({
              ...s,
              status: 'reconnecting',
              reconnectAttempts: s.reconnectAttempts + 1,
            }));
            connectMessageWs();
          }, delay);

          return {
            ...prev,
            status: 'reconnecting',
            reconnectDelay: delay,
            reconnectAttempts: prev.reconnectAttempts + 1,
          };
        });
      };

      messageWsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to message WebSocket:', error);
      setMessageWsState((prev) => ({ ...prev, status: 'disconnected' }));
    }
  }, [calculateBackoffDelay, handleMessageData, showStatus]);

  /**
   * Send message through reload WebSocket
   * @param message Message to send
   */
  const sendReloadMessage = useCallback((message: WSReloadMessage) => {
    if (reloadWsRef.current?.readyState === WebSocket.OPEN) {
      try {
        reloadWsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send reload message:', error);
      }
    } else {
      console.warn('Reload WebSocket is not connected');
    }
  }, []);

  /**
   * Send message through message WebSocket
   * @param message Message to send
   */
  const sendMessageBatch = useCallback((message: WSBatchCompleteMessage) => {
    if (messageWsRef.current?.readyState === WebSocket.OPEN) {
      try {
        messageWsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send batch message:', error);
      }
    } else {
      console.warn('Message WebSocket is not connected');
    }
  }, []);

  /**
   * Initialize WebSocket connections on component mount
   */
  useEffect(() => {
    connectReloadWs();
    connectMessageWs();

    return () => {
      // Cleanup on unmount
      if (reloadWsRef.current) {
        reloadWsRef.current.close();
        reloadWsRef.current = null;
      }

      if (messageWsRef.current) {
        messageWsRef.current.close();
        messageWsRef.current = null;
      }

      if (reloadReconnectTimerRef.current) {
        clearTimeout(reloadReconnectTimerRef.current);
      }

      if (messageReconnectTimerRef.current) {
        clearTimeout(messageReconnectTimerRef.current);
      }
    };
  }, [connectReloadWs, connectMessageWs]);

  return {
    reloadStatus: reloadWsState.status,
    messageStatus: messageWsState.status,
    sendReloadMessage,
    sendMessageBatch,
    isConnected: reloadWsState.status === 'connected' && messageWsState.status === 'connected',
  };
}

export default useWebSocket;
