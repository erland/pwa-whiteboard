import { toWsUrl } from './collabUrl';
import type {
  BoardRole,
  ClientToServerMessage,
  PresencePayload,
  ServerToClientMessage,
  WhiteboardOp,
  PresenceUser,
} from './protocol';
import { parseAndValidateServerMessage } from './protocol/validation';
import type { JavaWhiteboardServerWsMessage, WsEphemeralMessage } from '../api/javaWhiteboardServerContract';

export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export type CollabClientHandlers = {
  onStatus?: (status: CollabStatus, error?: string) => void;
  onJoined?: (msg: Extract<ServerToClientMessage, { type: 'joined' }>) => void;
  onOp?: (msg: Extract<ServerToClientMessage, { type: 'op' }>) => void;
  onPresence?: (msg: Extract<ServerToClientMessage, { type: 'presence' }>) => void;
  onErrorMsg?: (msg: Extract<ServerToClientMessage, { type: 'error' }>) => void;
  onEphemeral?: (msg: WsEphemeralMessage) => void;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeErrorCode(code: string): Extract<ServerToClientMessage, { type: 'error' }>['code'] {
  const normalized = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  switch (normalized) {
    case 'bad_request':
    case 'unauthorized':
    case 'forbidden':
    case 'not_found':
    case 'rate_limited':
    case 'payload_too_large':
    case 'server_error':
    case 'board_too_large':
    case 'stroke_too_long':
    case 'text_too_long':
      return normalized;
    case 'feature_disabled':
    case 'validation_error':
      return 'bad_request';
    default:
      return 'server_error';
  }
}

function parseJavaServerFallback(raw: string): JavaWhiteboardServerWsMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.type !== 'string') return null;
    if (parsed.type === 'ephemeral'
      && typeof parsed.boardId === 'string'
      && typeof parsed.from === 'string'
      && typeof parsed.eventType === 'string') {
      return parsed as unknown as WsEphemeralMessage;
    }
    if (parsed.type === 'error' && typeof parsed.code === 'string' && typeof parsed.message === 'string') {
      return parsed as unknown as JavaWhiteboardServerWsMessage;
    }
    return null;
  } catch {
    return null;
  }
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
      if (res.ok) {
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
            break;
        }
        return;
      }

      const fallback = parseJavaServerFallback(raw);
      if (!fallback) return;

      if (fallback.type === 'ephemeral') {
        this.handlers.onEphemeral?.(fallback);
        return;
      }

      if (fallback.type === 'error') {
        const code = normalizeErrorCode(String(fallback.code));
        const message = String(fallback.message);
        const fatal = Boolean((fallback as any).fatal);
        const errText = `${code}: ${message}`;
        this.handlers.onErrorMsg?.({ type: 'error', code, message, fatal });
        if (fatal) {
          this.setStatus('error', errText);
          try {
            this.ws?.close();
          } catch {
            // ignore
          }
        }
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
    void boardId;
    if (!this.ws || this.status !== 'connected' || !presence) return false;

    let sent = false;

    if (presence.cursor) {
      this.ws.send(JSON.stringify({
        type: 'ephemeral',
        eventType: 'cursor',
        payload: { x: presence.cursor.x, y: presence.cursor.y },
      }));
      sent = true;
    }

    if (presence.viewport) {
      this.ws.send(JSON.stringify({
        type: 'ephemeral',
        eventType: 'viewport',
        payload: {
          panX: presence.viewport.panX,
          panY: presence.viewport.panY,
          zoom: presence.viewport.zoom,
        },
      }));
      sent = true;
    }

    if (presence.selectionIds || presence.isTyping !== undefined) {
      this.ws.send(JSON.stringify({
        type: 'ephemeral',
        eventType: 'presence-meta',
        payload: {
          ...(presence.selectionIds ? { selectionIds: presence.selectionIds } : {}),
          ...(presence.isTyping !== undefined ? { isTyping: presence.isTyping } : {}),
        },
      }));
      sent = true;
    }

    return sent;
  }

  sendEphemeral(eventType: WsEphemeralMessage['eventType'], payload: Record<string, unknown>) {
    if (!this.ws || this.status !== 'connected') return false;
    this.ws.send(JSON.stringify({ type: 'ephemeral', eventType, payload }));
    return true;
  }

  private setStatus(next: CollabStatus, error?: string) {
    this.status = next;
    this.handlers.onStatus?.(next, error);
  }
}
