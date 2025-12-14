import { BOARD_TYPES, boardTypeHasSelection, getBoardType } from '../boardTypes';

describe('boardTypes', () => {
  test('getBoardType falls back to advanced', () => {
    expect(getBoardType('does-not-exist').id).toBe('advanced');
    expect(getBoardType(undefined).id).toBe('advanced');
    expect(getBoardType(null).id).toBe('advanced');
  });

  test('all board types include selection tool in toolbox', () => {
    (Object.values(BOARD_TYPES) as Array<(typeof BOARD_TYPES)[keyof typeof BOARD_TYPES]>).forEach(
      (def) => {
        expect(boardTypeHasSelection(def)).toBe(true);
      }
    );
  });
});
