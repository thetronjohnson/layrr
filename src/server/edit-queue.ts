import { execSync } from 'child_process';
import type { SourceLocation } from '../editor/source-mapper.js';

export interface ElementEditInfo {
  tagName: string;
  className: string;
  textContent: string;
  selector: string;
  sourceLocation: SourceLocation | null;
}

export interface PendingEditRequest {
  instruction: string;
  tagName: string;
  className: string;
  textContent: string;
  selector: string;
  sourceLocation: SourceLocation | null;
  elements?: ElementEditInfo[];
}

type EditResolver = (request: PendingEditRequest) => void;
type WsNotifier = (success: boolean, message?: string, canUndo?: boolean) => void;
type UndoNotifier = (success: boolean, message: string) => void;

export interface EditResult {
  success: boolean;
  message: string;
  timestamp: number;
  canUndo?: boolean;
}

const LAYRR_PREFIX = '[layrr]';

class EditQueue {
  private waitingResolver: EditResolver | null = null;
  private wsNotifier: WsNotifier | null = null;
  private undoNotifier: UndoNotifier | null = null;
  private _lastResult: EditResult | null = null;
  private _projectRoot: string = '';

  get lastResult(): EditResult | null {
    return this._lastResult;
  }

  set projectRoot(root: string) {
    this._projectRoot = root;
  }

  get canUndo(): boolean {
    if (!this._projectRoot) return false;
    try {
      const msg = execSync('git log -1 --format=%s', { cwd: this._projectRoot, encoding: 'utf-8' }).trim();
      return msg.startsWith(LAYRR_PREFIX);
    } catch {
      return false;
    }
  }

  push(request: PendingEditRequest) {
    if (this.waitingResolver) {
      const resolve = this.waitingResolver;
      this.waitingResolver = null;
      resolve(request);
    }
  }

  waitForNext(): Promise<PendingEditRequest> {
    return new Promise((resolve) => {
      this.waitingResolver = resolve;
    });
  }

  setWsNotifier(notifier: WsNotifier) {
    this.wsNotifier = notifier;
  }

  setUndoNotifier(notifier: UndoNotifier) {
    this.undoNotifier = notifier;
  }

  undo(): { success: boolean; message: string } {
    if (!this.canUndo) {
      return { success: false, message: 'Nothing to undo' };
    }
    try {
      execSync('git revert HEAD --no-edit', { cwd: this._projectRoot, stdio: 'pipe' });
      const result = { success: true, message: 'Reverted last edit' };
      if (this.undoNotifier) {
        this.undoNotifier(result.success, result.message);
      }
      return result;
    } catch (err: any) {
      const result = { success: false, message: `Undo failed: ${err.message}` };
      if (this.undoNotifier) {
        this.undoNotifier(result.success, result.message);
      }
      return result;
    }
  }

  notifyComplete(success: boolean, message?: string) {
    const canUndo = success && this.canUndo;
    this._lastResult = {
      success,
      message: message || (success ? 'Edit applied!' : 'Edit failed'),
      timestamp: Date.now(),
      canUndo,
    };
    if (this.wsNotifier) {
      this.wsNotifier(success, message, canUndo);
    }
  }
}

export const editQueue = new EditQueue();
