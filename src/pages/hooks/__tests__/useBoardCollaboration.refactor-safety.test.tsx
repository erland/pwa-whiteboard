import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { useBoardCollaboration } from '../useBoardCollaboration';

const mockUseAuth = jest.fn();
const mockBootstrapSnapshotOnJoin = jest.fn();
let latestHandlers: any;

jest.mock('../../../auth/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../config/server', () => ({ getApiBaseUrl: () => 'https://api.example.test', getWsBaseUrl: () => 'wss://ws.example.test' }));
jest.mock('../collab/collabIdentity', () => ({ getInviteTokenFromUrl: () => 'invite-1', getOrCreateGuestId: () => 'guest-1' }));
jest.mock('../collab/collabJoinAuth', () => ({ normalizeQueryToken: (v: string) => v, resolveCollabJoinAuth: () => ({ accessToken: 'token-1', inviteToken: 'invite-1', displayName: 'Alice', initialSelfUserId: 'guest-1', restEnabled: true, wsEnabled: true, enabled: true, boardEnsured: true, authKey: 'auth-key-1' }) }));
jest.mock('../collab/useSnapshotOrchestration', () => ({ useSnapshotOrchestration: () => ({ bootstrapSnapshotOnJoin: (...args: unknown[]) => mockBootstrapSnapshotOnJoin(...args) }) }));
jest.mock('../collab/usePresenceSender', () => ({ usePresenceSender: () => ({ sendOp: jest.fn(), sendPresence: jest.fn() }) }));
jest.mock('../collab/useAutoReconnect', () => ({ useAutoReconnect: () => {} }));
jest.mock('../../../collab/CollabClient', () => ({ CollabClient: class MockCollabClient { handlers: any; constructor(_config: any, handlers: any) { this.handlers = handlers; latestHandlers = handlers; } connect() { this.handlers.onStatus?.('connecting'); } close() { this.handlers.onStatus?.('closed'); } sendOp() {} sendPresence() {} } }));

function Harness() {
  const result = useBoardCollaboration({ boardId: 'board-1', boardMetaId: 'board-1', state: null, resetBoard: jest.fn(), applyRemoteEvent: jest.fn() });
  return <output data-testid="collab">{JSON.stringify(result)}</output>;
}

describe('useBoardCollaboration refactor safety net', () => {
  beforeEach(() => {
    latestHandlers = undefined;
    mockBootstrapSnapshotOnJoin.mockReset();
    mockUseAuth.mockReturnValue({});
  });

  test('maps joined presence fallback data and updates the local identity', () => {
    render(<Harness />);
    expect(latestHandlers).toBeTruthy();
    act(() => { latestHandlers.onJoined({ userId: 'user-42', role: 'editor', presentUserIds: ['user-42', 'user-99'] }); });
    const state = JSON.parse(screen.getByTestId('collab').textContent || 'null');
    expect(state.status).toBe('connecting');
    expect(state.selfUserId).toBe('user-42');
    expect(state.role).toBe('editor');
    expect(state.users).toEqual([{ userId: 'user-42', displayName: 'user-42', role: 'viewer' }, { userId: 'user-99', displayName: 'user-99', role: 'viewer' }]);
    expect(state.presenceByUserId).toEqual({});
    expect(mockBootstrapSnapshotOnJoin).toHaveBeenCalledWith({ userId: 'user-42', role: 'editor', presentUserIds: ['user-42', 'user-99'] });
  });
});
