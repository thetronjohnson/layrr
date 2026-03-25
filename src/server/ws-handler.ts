import type { WebSocket } from 'ws';
import { execSync } from 'child_process';
import { resolveSource } from '../editor/source-mapper.js';
import { editQueue } from './edit-queue.js';

interface ElementInfo {
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  sourceInfo?: { file: string; line: number; column?: number };
}

interface EditRequestMsg {
  type: 'edit-request';
  selector: string;
  tagName: string;
  className: string;
  textContent: string;
  instruction: string;
  sourceInfo?: { file: string; line: number; column?: number };
  elements?: ElementInfo[];
}

// Track the latest active WebSocket so edit results go to the current page
let activeWs: WebSocket | null = null;
// Track original branch when previewing versions
let originalBranch: string | null = null;

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

        if (editMsg.elements && editMsg.elements.length > 1) {
          // Multi-element edit
          const resolvedElements = await Promise.all(
            editMsg.elements.map(async (el) => ({
              tagName: el.tagName,
              className: el.className,
              textContent: el.textContent,
              selector: el.selector,
              sourceLocation: await resolveSource({
                selector: el.selector,
                tagName: el.tagName,
                className: el.className,
                textContent: el.textContent,
                sourceInfo: el.sourceInfo,
                projectRoot,
              }),
            }))
          );

          editQueue.push({
            instruction: editMsg.instruction,
            tagName: editMsg.tagName,
            className: editMsg.className,
            textContent: editMsg.textContent,
            selector: editMsg.selector,
            sourceLocation: resolvedElements[0].sourceLocation,
            elements: resolvedElements,
          });
        } else {
          // Single element edit
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
      } else if (msg.type === 'version-preview') {
        try {
          if (!originalBranch) {
            try {
              originalBranch = execSync('git symbolic-ref --short HEAD', { cwd: projectRoot, encoding: 'utf-8' }).trim();
            } catch {
              originalBranch = 'main';
            }
          }
          const commitMsg = execSync(`git log -1 --format=%s ${msg.hash}`, { cwd: projectRoot, encoding: 'utf-8' }).trim().replace('[layrr] ', '');
          // Send response BEFORE checkout (checkout triggers reload which kills the WS)
          try { ws.send(JSON.stringify({ type: 'version-preview-result', success: true, hash: msg.hash, message: commitMsg })); } catch {}
          execSync(`git checkout ${msg.hash} --detach`, { cwd: projectRoot, stdio: 'pipe' });
          console.log(`  ⏪ Previewing: ${commitMsg}`);
        } catch (err: any) {
          console.log(`  ✗ Preview failed: ${err.message}`);
          try { ws.send(JSON.stringify({ type: 'version-preview-result', success: false, message: err.message })); } catch {}
        }
      } else if (msg.type === 'version-restore') {
        if (!originalBranch) return;
        try {
          const branch = originalBranch;
          originalBranch = null;
          try { ws.send(JSON.stringify({ type: 'version-restore-result', success: true, branch })); } catch {}
          execSync(`git checkout ${branch}`, { cwd: projectRoot, stdio: 'pipe' });
          console.log(`  ↩ Restored to ${branch}`);
        } catch (err: any) {
          try { ws.send(JSON.stringify({ type: 'version-restore-result', success: false, message: err.message })); } catch {}
        }
      } else if (msg.type === 'version-revert') {
        try {
          const branch = originalBranch || execSync('git symbolic-ref --short HEAD 2>/dev/null || echo main', { cwd: projectRoot, encoding: 'utf-8' }).trim();
          try { execSync(`git checkout ${branch}`, { cwd: projectRoot, stdio: 'pipe' }); } catch {}
          try { ws.send(JSON.stringify({ type: 'version-revert-result', success: true, hash: msg.hash })); } catch {}
          execSync(`git reset --hard ${msg.hash}`, { cwd: projectRoot, stdio: 'pipe' });
          originalBranch = null;
          console.log(`  ⚠ Permanently reverted to ${msg.hash.slice(0, 7)}`);
        } catch (err: any) {
          console.log(`  ✗ Revert failed: ${err.message}`);
          try { ws.send(JSON.stringify({ type: 'version-revert-result', success: false, message: err.message })); } catch {}
        }
      }
    } catch (err) {
      console.error('[layrr] Error handling WS message:', err);
    }
  });
}
