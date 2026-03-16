import type { SourceLocation } from '../editor/source-mapper.js';

export interface PendingEditRequest {
  instruction: string;
  tagName: string;
  className: string;
  textContent: string;
  selector: string;
  sourceLocation: SourceLocation | null;
}

type EditResolver = (request: PendingEditRequest) => void;
type WsNotifier = (success: boolean, message?: string) => void;

class EditQueue {
  private waitingResolver: EditResolver | null = null;
  private wsNotifier: WsNotifier | null = null;

  push(request: PendingEditRequest) {
    if (this.waitingResolver) {
      const resolve = this.waitingResolver;
      this.waitingResolver = null;
      resolve(request);
    }
    // If no one is waiting, drop it (Claude Code will call get_edit_request again)
  }

  waitForNext(): Promise<PendingEditRequest> {
    return new Promise((resolve) => {
      this.waitingResolver = resolve;
    });
  }

  setWsNotifier(notifier: WsNotifier) {
    this.wsNotifier = notifier;
  }

  notifyComplete(success: boolean, message?: string) {
    if (this.wsNotifier) {
      this.wsNotifier(success, message);
    }
  }
}

export const editQueue = new EditQueue();
