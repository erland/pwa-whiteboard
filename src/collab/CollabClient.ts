import { toWsUrl } from './collabUrl';
import type {
  BoardRole,
  ClientToServerMessage,
  PresencePayload,
  ServerToClientMessage,
  WhiteboardOp,
  PresenceUser,
} from '../../shared/protocol';
import { parseAndValidateServerMessage } from '../../shared/protocol/validation';

export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export type CollabClientHandlers = {
  onStatus?: (status: CollabStatus, error?: string) => void;
  onJoined?: (msg: Extract<ServerToClientMessage, { type: 'joined' }>) => void;
  onOp?: (msg: Extract<ServerToClientMessage, { type: 'op' }>) => void;
  onPresence?: (msg: Extract<ServerToClientMessage, { type: 'presence' }>) => void;
  onErrorMsg?: (msg: Extract<ServerToClientMessage, { type: 'error' }>) => void;
};

export type CollabClientOptions = {
  baseUrl: string;
  boardId: string;
  inviteToken: string;
  guestId?: string;
  displayName?: string;
  color?: string;
};

function generateClientOpId(): string {
  return 'cop_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}

export class CollabClient {
  private ws: WebSocket | null = null;
  private status: CollabStatus = 'idle';
  private readonly opts: CollabClientOptions;
  private readonly handlers: CollabClientHandlers;

  constructor(opts: CollabClientOptions, handlers: CollabClientHandlers) {
    this.opts = opts;
    this.handlers = handlers;
  }

  connect() {
    if (this.ws) return;

    const url = toWsUrl(this.opts.baseUrl, `/collab/${encodeURIComponent(this.opts.boardId)}`);
    this.setStatus('connecting');

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      // Join with invite token (Step 8 MVP)
      const join: ClientToServerMessage = {
        type: 'join',
        boardId: this.opts.boardId,
        auth: { kind: 'invite', inviteToken: this.opts.inviteToken },
        client: {
          guestId: this.opts.guestId,
          displayName: this.opts.displayName,
          color: this.opts.color,
        },
      };
      ws.send(JSON.stringify(join));
    };

    ws.onmessage = (evt) => {
      const raw = typeof evt.data === 'string' ? evt.data : '';
      if (!raw) return;

      const res = parseAndValidateServerMessage(raw);
      if (!res.ok) return;

      const msg = res.value;
      switch (msg.type) {
        case 'joined':
          this.setStatus('connected');
          this.handlers.onJoined?.(msg);
          break;
        case 'op':
          this.handlers.onOp?.(msg);
          break;
        case 'presence':
          this.handlers.onPresence?.(msg);
          break;
        case 'error':
          this.handlers.onErrorMsg?.(msg);
          break;
        case 'pong':
          // ignore
          break;
      }
    };

    ws.onerror = () => {
      this.setStatus('error', 'WebSocket error');
    };

    ws.onclose = () => {
      this.ws = null;
      this.setStatus('closed');
    };
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.ws = null;
    this.setStatus('closed');
  }

  sendOp(op: WhiteboardOp, boardId: string, baseSeq?: number): string | null {
    if (!this.ws || this.status !== 'connected') return null;
    const clientOpId = generateClientOpId();
    const msg: ClientToServerMessage = {
      type: 'op',
      boardId,
      clientOpId,
      baseSeq: baseSeq ?? 0,
      op,
    };
    this.ws.send(JSON.stringify(msg));
    return clientOpId;
  }

  sendPresence(boardId: string, presence: PresencePayload) {
    if (!this.ws || this.status !== 'connected') return;
    const msg: ClientToServerMessage = {
      type: 'presence',
      boardId,
      presence,
    };
    this.ws.send(JSON.stringify(msg));
  }

  private setStatus(next: CollabStatus, error?: string) {
    this.status = next;
    this.handlers.onStatus?.(next, error);
  }
}