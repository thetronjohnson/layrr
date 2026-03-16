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

export function handleWsConnection(ws: WebSocket, projectRoot: string) {
  // Register notifier so MCP can send results back to the overlay
  editQueue.setWsNotifier((success, message) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'edit-result',
        success,
        message: message || (success ? 'Edit applied!' : 'Edit failed'),
      }));
    }
  });

  ws.on('message', async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'edit-request') {
        const editMsg = msg as EditRequestMsg;

        // Resolve source location
        const sourceLocation = await resolveSource({
          selector: editMsg.selector,
          tagName: editMsg.tagName,
          className: editMsg.className,
          textContent: editMsg.textContent,
          sourceInfo: editMsg.sourceInfo,
          projectRoot,
        });

        // Push to queue — the MCP get_edit_request tool is waiting for this
        editQueue.push({
          instruction: editMsg.instruction,
          tagName: editMsg.tagName,
          className: editMsg.className,
          textContent: editMsg.textContent,
          selector: editMsg.selector,
          sourceLocation,
        });
      }
    } catch {}
  });
}
