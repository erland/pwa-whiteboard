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
  accessToken?: string;
  inviteToken?: string;
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
  private connecting = false;
  private manualClose = false;
  private readonly opts: CollabClientOptions;
  private readonly handlers: CollabClientHandlers;

  constructor(opts: CollabClientOptions, handlers: CollabClientHandlers) {
    this.opts = opts;
    this.handlers = handlers;
  }

  connect() {
    // Avoid connect storms: if a socket is already open/connecting, do nothing.
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this.connecting) return;
    this.manualClose = false;
    this.connecting = true;

    const url0 = toWsUrl(this.opts.baseUrl, `/ws/boards/${encodeURIComponent(this.opts.boardId)}`);
    const u = new URL(url0);
    // Apply auth.
    // Browser WebSocket API can't set Authorization headers, so we support query params.
    // Server prefers Authorization header, but also accepts access_token and invite.
    if (this.opts.accessToken && this.opts.accessToken.trim()) {
      u.searchParams.set('access_token', this.opts.accessToken.trim());
      u.searchParams.delete('invite');
    } else if (this.opts.inviteToken && this.opts.inviteToken.trim()) {
      u.searchParams.set('invite', this.opts.inviteToken.trim());
      u.searchParams.delete('access_token');
    } else {
      // No auth - server will likely reject.
      u.searchParams.delete('access_token');
      u.searchParams.delete('invite');
    }
    const url = u.toString();
    this.setStatus('connecting');

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connecting = false;
      // Server sends `joined` immediately after successful connect + auth.
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
        case 'error': {
          const errText = `${msg.code}: ${msg.message}`;

          // Non-fatal errors are "soft" (e.g. rate-limits, payload too large). Keep the
          // connection alive and let the UI show a notice. Only fatal errors flip
          // the connection status to error and close the socket.
          this.handlers.onErrorMsg?.(msg);

          if (msg.fatal) {
            this.setStatus('error', errText);
            try {
              this.ws?.close();
            } catch {
              // ignore
            }
          }
          break;
        }
        case 'pong':
          // ignore
          break;
      }
    };

    ws.onerror = () => {
      this.setStatus('error', 'WebSocket error');
    };

    ws.onclose = (evt) => {
      this.ws = null;
      this.connecting = false;
      const reason = evt?.reason ? `: ${evt.reason}` : '';
      if (this.manualClose) {
        this.manualClose = false;
        this.setStatus('closed', `WebSocket closed (${evt.code})${reason}`);
        return;
      }
      if (this.status !== 'error') {
        this.setStatus('closed', `WebSocket closed (${evt.code})${reason}`);
      }
    };
  }

  close() {
    this.manualClose = true;
    this.connecting = false;
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
      clientOpId,
      baseSeq: baseSeq ?? 0,
      op,
    };
    this.ws.send(JSON.stringify(msg));
    return clientOpId;
  }

  sendPresence(boardId: string, presence: PresencePayload) {
    // Current server protocol does not accept client-side presence payloads.
    // Keep the method for UI compatibility; it is intentionally a no-op.
    void boardId;
    void presence;
  }

  private setStatus(next: CollabStatus, error?: string) {
    this.status = next;
    this.handlers.onStatus?.(next, error);
  }
}
