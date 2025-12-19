// Minimal Cloudflare Workers / Durable Objects type declarations.
// These are intentionally small to keep local typechecking working without extra deps.
// In production you can replace this by adding @cloudflare/workers-types.

type WebSocketCloseCode = number;

interface WebSocket {
  accept(): void;
  send(message: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: WebSocketCloseCode, reason?: string): void;
  addEventListener(
    type: "message" | "close" | "error",
    listener: (event: any) => void
  ): void;
}

interface WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

declare const WebSocketPair: {
  new (): WebSocketPair;
};

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}

interface DurableObject {
  fetch(request: Request): Promise<Response>;
}
