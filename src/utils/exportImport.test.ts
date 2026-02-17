import { describe, it, expect } from 'vitest';
import { validateImport } from './exportImport';

describe('validateImport', () => {
  it('should return true for a valid V2 conversation object', () => {
    const validV2 = {
      id: 'conversation-123',
      messages: {
        'msg-1': { id: 'msg-1', role: 'user', text: 'Hello', timestamp: 1234567890 }
      },
      branches: {
        'branch-1': { id: 'branch-1', name: 'Main', createdAt: 1234567890, parentMessageId: null }
      },
      activeBranchId: 'branch-1'
    };
    expect(validateImport(validV2)).toBe(true);
  });

  it('should return true for V2 with empty messages and branches', () => {
    const validV2Empty = {
      messages: {},
      branches: {},
      activeBranchId: 'branch-main'
    };
    expect(validateImport(validV2Empty)).toBe(true);
  });

  it('should return false if "messages" is missing', () => {
    const invalid = {
      branches: {},
      activeBranchId: 'branch-1'
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return false if "branches" is missing', () => {
    const invalid = {
      messages: {},
      activeBranchId: 'branch-1'
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return false if "activeBranchId" is missing', () => {
    const invalid = {
      messages: {},
      branches: {}
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return false if "messages" is not an object', () => {
    const invalid = {
      messages: [],
      branches: {},
      activeBranchId: 'main'
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return false if "branches" is not an object', () => {
    const invalid = {
      messages: {},
      branches: 'not-an-object',
      activeBranchId: 'main'
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return false if "activeBranchId" is not a string', () => {
    const invalid = {
      messages: {},
      branches: {},
      activeBranchId: 123
    };
    expect(validateImport(invalid)).toBe(false);
  });

  it('should return true for a valid legacy V1 format (array of messages)', () => {
    const legacyV1 = [
      { id: 'msg-1', role: 'user', text: 'Hello' }
    ];
    expect(validateImport(legacyV1)).toBe(true);
  });

  it('should return true for an empty array (legacy)', () => {
    expect(validateImport([])).toBe(true);
  });

  it('should return false for invalid legacy format (array of invalid objects)', () => {
    const invalidLegacy = [{ foo: 'bar' }]; // Missing id or text
    expect(validateImport(invalidLegacy)).toBe(false);
  });

  it('should return false for null', () => {
    expect(validateImport(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(validateImport(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(validateImport('string')).toBe(false);
    expect(validateImport(123)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(validateImport({})).toBe(false);
  });
});
