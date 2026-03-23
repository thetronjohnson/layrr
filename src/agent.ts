import { spawnSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PendingEditRequest } from './server/edit-queue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const claudeBin = join(__dirname, '..', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');

export function checkClaude(): { ok: boolean; error?: string } {
  try {
    const result = spawnSync('node', [claudeBin, '--version'], {
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      const version = result.stdout?.toString().trim();
      return { ok: true };
    }

    const stderr = result.stderr?.toString() || '';
    const stderrLower = stderr.toLowerCase();
    if (stderrLower.includes('auth') || stderrLower.includes('login') ||
        stderrLower.includes('api key') || stderrLower.includes('credentials') ||
        stderrLower.includes('bedrock') || stderrLower.includes('not configured')) {
      return { ok: false, error: 'not-authenticated' };
    }

    return { ok: false, error: `claude exited with code ${result.status}` };
  } catch {
    return { ok: false, error: 'not-found' };
  }
}

interface AgentOptions {
  projectRoot: string;
}

export class ClaudeAgent {
  private sessionId: string;
  private projectRoot: string;

  constructor(opts: AgentOptions) {
    this.sessionId = randomUUID();
    this.projectRoot = opts.projectRoot;
  }

  async applyEdit(request: PendingEditRequest): Promise<{ success: boolean; message: string }> {
    const { instruction, tagName, className, textContent, selector, sourceLocation, elements } = request;

    let prompt: string;

    if (elements && elements.length > 1) {
      // Multi-element edit
      prompt = `The user is visually editing their web app. They selected ${elements.length} UI elements and want to make a change to all of them.

**Selected elements:**`;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        prompt += `

Element ${i + 1}:
- Tag: <${el.tagName}>
- Class: "${el.className}"
- Text: "${el.textContent}"
- Selector: ${el.selector}`;

        if (el.sourceLocation) {
          prompt += `
- File: ${el.sourceLocation.filePath}:${el.sourceLocation.line}
- Code context:
\`\`\`
${el.sourceLocation.context}
\`\`\``;
        }
      }

      prompt += `

**User instruction (apply to ALL selected elements):** "${instruction}"

Read each file, make the minimal edits needed, and save. Apply the same change to all selected elements. Only change what was requested.`;
    } else {
      // Single element edit
      prompt = `The user is visually editing their web app. They selected a UI element and want to make a change.

**Selected element:**
- Tag: <${tagName}>
- Class: "${className}"
- Text: "${textContent}"
- Selector: ${selector}`;

      if (sourceLocation) {
        prompt += `

**Source location found:**
- File: ${sourceLocation.filePath}
- Line: ${sourceLocation.line}
- Code context:
\`\`\`
${sourceLocation.context}
\`\`\``;
      }

      prompt += `

**User instruction:** "${instruction}"

Read the file, make the minimal edit needed, and save it. Only change what was requested.`;
    }

    return new Promise((resolve) => {
      const args = [
        claudeBin,
        '--print',
        '--output-format', 'text',
        '--dangerously-skip-permissions',
        '--session-id', this.sessionId,
        '--no-session-persistence',
        '-p', prompt,
      ];

      const proc = spawn('node', args, {
        cwd: this.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: stdout.trim().slice(-200) || 'Edit applied',
          });
        } else {
          const err = stderr.trim();
          const errLower = err.toLowerCase();
          if (errLower.includes('auth') || errLower.includes('login') ||
              errLower.includes('api key') || errLower.includes('credentials') ||
              errLower.includes('bedrock') || errLower.includes('not configured')) {
            resolve({ success: false, message: 'Claude Code authentication failed. Run: claude login' });
          } else {
            resolve({ success: false, message: err.slice(-200) || `Claude exited with code ${code}` });
          }
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, message: `Failed to spawn Claude: ${err.message}` });
      });

      setTimeout(() => {
        proc.kill();
        resolve({ success: false, message: 'Edit timed out after 60 seconds' });
      }, 60000);
    });
  }
}
