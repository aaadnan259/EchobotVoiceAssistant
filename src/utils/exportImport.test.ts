import { describe, it, expect } from 'vitest';
import { validateImport, generateJSON } from './exportImport';
import { Conversation } from '../types';

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

describe('generateJSON', () => {
  const sampleConversation: Conversation = {
    id: 'conv-1',
    branches: {
      'branch-1': { id: 'branch-1', name: 'Main', createdAt: 100, parentMessageId: null }
    },
    activeBranchId: 'branch-1',
    messages: {
      'msg-1': {
        id: 'msg-1',
        role: 'user',
        text: 'Hello',
        timestamp: 100,
        image: 'data:image/png;base64,dummy'
      },
      'msg-2': {
        id: 'msg-2',
        role: 'model',
        text: 'Hi there',
        timestamp: 101,
        // No image
      },
      'msg-3': {
        id: 'msg-3',
        role: 'user',
        text: 'Look at this',
        timestamp: 102,
        image: 'data:image/jpeg;base64,anotherdummy'
      }
    }
  };

  it('should include images by default', () => {
    const json = generateJSON(sampleConversation);
    const parsed = JSON.parse(json);
    expect(parsed.messages['msg-1'].image).toBeDefined();
    expect(parsed.messages['msg-3'].image).toBeDefined();
    expect(parsed.messages['msg-1'].image).toBe('data:image/png;base64,dummy');
  });

  it('should include images when includeImages is true', () => {
    const json = generateJSON(sampleConversation, { includeImages: true });
    const parsed = JSON.parse(json);
    expect(parsed.messages['msg-1'].image).toBeDefined();
    expect(parsed.messages['msg-3'].image).toBeDefined();
  });

  it('should exclude images when includeImages is false', () => {
    const json = generateJSON(sampleConversation, { includeImages: false });
    const parsed = JSON.parse(json);
    expect(parsed.messages['msg-1'].image).toBeUndefined();
    expect(parsed.messages['msg-3'].image).toBeUndefined();
    // Verify other fields remain
    expect(parsed.messages['msg-1'].text).toBe('Hello');
    expect(parsed.messages['msg-3'].text).toBe('Look at this');
  });

  it('should not mutate the original conversation object', () => {
    generateJSON(sampleConversation, { includeImages: false });
    expect(sampleConversation.messages['msg-1'].image).toBeDefined();
    expect(sampleConversation.messages['msg-3'].image).toBeDefined();
  });

  it('should handle conversations without images gracefully when excluding images', () => {
    const noImageConv: Conversation = {
        ...sampleConversation,
        messages: {
            'msg-1': { id: 'msg-1', role: 'user', text: 'Hello', timestamp: 100 }
        }
    };
    const json = generateJSON(noImageConv, { includeImages: false });
    const parsed = JSON.parse(json);
    expect(parsed.messages['msg-1'].image).toBeUndefined();
    expect(parsed.messages['msg-1'].text).toBe('Hello');
  });
});
