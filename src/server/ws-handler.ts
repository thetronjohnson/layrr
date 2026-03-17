import type { WebSocket } from 'ws';
import { resolveSource } from '../editor/source-mapper.js';
import { editQueue } from './edit-queue.js';

interface EditRequestMsg {
  type: 'edit-request';
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  instruction: string;
  sourceInfo?: { file: string; line: number; column?: number };
}

// Track the latest active WebSocket so edit results go to the current page
let activeWs: WebSocket | null = null;

// Set up the notifier once — it always sends to the latest WS
editQueue.setWsNotifier((success, message) => {
  const payload = JSON.stringify({
    type: 'edit-result',
    success,
    message: message || (success ? 'Edit applied!' : 'Edit failed'),
  });
  if (!activeWs) {
    console.warn('[layrr] No active WebSocket to send edit-result');
    return;
  }
  if (activeWs.readyState !== activeWs.OPEN) {
    console.warn(`[layrr] WebSocket not OPEN (readyState=${activeWs.readyState}), cannot send edit-result`);
    return;
  }
  try {
    activeWs.send(payload);
    console.log(`[layrr] Sent edit-result via WebSocket (success=${success})`);
  } catch (err) {
    console.error('[layrr] Failed to send edit-result via WebSocket:', err);
  }
});

export function handleWsConnection(ws: WebSocket, projectRoot: string) {
  activeWs = ws;

  ws.on('close', () => {
    if (activeWs === ws) activeWs = null;
  });

  ws.on('message', async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'edit-request') {
        const editMsg = msg as EditRequestMsg;

        const sourceLocation = await resolveSource({
          selector: editMsg.selector,
          tagName: editMsg.tagName,
          className: editMsg.className,
          textContent: editMsg.textContent,
          sourceInfo: editMsg.sourceInfo,
          projectRoot,
        });

        editQueue.push({
          instruction: editMsg.instruction,
          tagName: editMsg.tagName,
          className: editMsg.className,
          textContent: editMsg.textContent,
          selector: editMsg.selector,
          sourceLocation,
        });
      }
    } catch (err) {
      console.error('[layrr] Error handling WS message:', err);
    }
  });
}
