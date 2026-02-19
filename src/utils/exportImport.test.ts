import { describe, it, expect } from 'vitest';
import { validateImport, generateJSON, generateMarkdown } from './exportImport';
import { Conversation, Message } from '../types';

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

describe('generateMarkdown', () => {
  const mockDate = new Date('2023-10-27T10:00:00Z');

  // Helper to create mock messages
  const createMessage = (overrides: Partial<Message>): Message => ({
    id: 'msg-1',
    role: 'user',
    text: 'Hello',
    timestamp: mockDate.getTime(),
    ...overrides
  });

  it('should generate basic markdown for a conversation', () => {
    const messages: Message[] = [
      createMessage({ id: '1', role: 'user', text: 'Hello AI', timestamp: 1000 }),
      createMessage({ id: '2', role: 'model', text: 'Hello User', timestamp: 2000 })
    ];

    const md = generateMarkdown(messages);

    expect(md).toContain('# EchoBot Conversation');
    expect(md).toContain('## You');
    expect(md).toContain('Hello AI');
    expect(md).toContain('## EchoBot');
    expect(md).toContain('Hello User');
  });

  it('should filter messages by date range', () => {
    const messages: Message[] = [
      createMessage({ id: '1', text: 'Old', timestamp: 1000 }),
      createMessage({ id: '2', text: 'Target', timestamp: 2000 }),
      createMessage({ id: '3', text: 'Future', timestamp: 3000 })
    ];

    const options = {
      includeImages: false,
      dateRange: { start: 1500, end: 2500 }
    };

    const md = generateMarkdown(messages, options);

    expect(md).toContain('Target');
    expect(md).not.toContain('Old');
    expect(md).not.toContain('Future');
  });

  it('should include images when option is enabled', () => {
    const messages: Message[] = [
      createMessage({
        id: '1',
        text: 'Look at this',
        image: 'data:image/png;base64,fake'
      })
    ];

    const md = generateMarkdown(messages, { includeImages: true });

    expect(md).toContain('![Attached Image](data:image/png;base64,fake)');
    expect(md).not.toContain('*[Image attachment excluded]*');
  });

  it('should exclude images when option is disabled', () => {
    const messages: Message[] = [
      createMessage({
        id: '1',
        text: 'Look at this',
        image: 'data:image/png;base64,fake'
      })
    ];

    const md = generateMarkdown(messages, { includeImages: false });

    expect(md).toContain('*[Image attachment excluded]*');
    expect(md).not.toContain('![Attached Image]');
  });

  it('should format reactions correctly', () => {
    const messages: Message[] = [
      createMessage({
        id: '1',
        role: 'model',
        text: 'Response',
        reactions: { thumbsUp: true, starred: true }
      })
    ];

    const md = generateMarkdown(messages);

    expect(md).toContain('Reaction: 👍 ⭐');
  });

  it('should handle empty message list', () => {
    const md = generateMarkdown([]);
    expect(md).toContain('# EchoBot Conversation');
    // Should not have any message headers
    expect(md).not.toContain('## You');
    expect(md).not.toContain('## EchoBot');
  });
});
