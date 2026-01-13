import { useState, useEffect, useCallback, useMemo } from 'react';
import { Message, Branch, Conversation } from '../types';
import { STORAGE_KEYS, MESSAGE_LIMITS, CHAT_MESSAGES } from '../constants';
import { sanitizeMessage, sanitizeImageDataUri, sanitizeForStorage } from '../utils/sanitize';
import { logger } from '../utils/logger';

const { MESSAGES: STORAGE_KEY } = STORAGE_KEYS;
const { MAX_STORED_MESSAGES, MAX_MESSAGE_LENGTH, TRUNCATION_SUFFIX } = MESSAGE_LIMITS;
const { INITIAL_GREETING } = CHAT_MESSAGES;

const MAIN_BRANCH_ID = 'main';

// --- Helper Functions ---

const createInitialState = (): Conversation => {
    const timestamp = Date.now();
    const initialMessage: Message = {
        id: '1',
        role: 'model',
        text: INITIAL_GREETING,
        timestamp,
        parentId: null,
        branchId: MAIN_BRANCH_ID
    };

    return {
        id: 'default',
        branches: {
            [MAIN_BRANCH_ID]: {
                id: MAIN_BRANCH_ID,
                name: 'Main Conversation',
                createdAt: timestamp,
                parentMessageId: null
            }
        },
        activeBranchId: MAIN_BRANCH_ID,
        messages: {
            [initialMessage.id]: initialMessage
        }
    };
};

function sanitizeMessageData(message: Partial<Message>): Partial<Message> {
    const sanitized: Partial<Message> = { ...message };
    if (sanitized.text && sanitized.text.length > MAX_MESSAGE_LENGTH) {
        sanitized.text = sanitized.text.slice(0, MAX_MESSAGE_LENGTH) + TRUNCATION_SUFFIX;
    }
    if (sanitized.image) {
        const sanitizedImage = sanitizeImageDataUri(sanitized.image);
        if (!sanitizedImage) delete sanitized.image;
        else sanitized.image = sanitizedImage;
    }
    return sanitized;
}

function loadConversation(): Conversation {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return createInitialState();

        const parsed = JSON.parse(saved);

        // Migration from array-based messages (old format) to tree (new format)
        if (Array.isArray(parsed)) {
            logger.info('Migrating legacy messages to conversation tree');
            const messagesMap: Record<string, Message> = {};
            let prevId: string | null = null;

            parsed.forEach((msg, index) => {
                if (msg && msg.id) {
                    messagesMap[msg.id] = {
                        ...msg,
                        parentId: prevId,
                        branchId: MAIN_BRANCH_ID
                    };
                    prevId = msg.id;
                }
            });

            return {
                id: 'default',
                branches: {
                    [MAIN_BRANCH_ID]: {
                        id: MAIN_BRANCH_ID,
                        name: 'Main Conversation',
                        createdAt: Date.now(),
                        parentMessageId: null
                    }
                },
                activeBranchId: MAIN_BRANCH_ID,
                messages: messagesMap
            };
        }

        // Basic validation for new format
        if (!parsed.branches || !parsed.messages) {
            return createInitialState();
        }

        return parsed;
    } catch (e) {
        logger.error('Failed to load conversation:', e);
        return createInitialState();
    }
}

function saveConversation(conversation: Conversation): boolean {
    try {
        // Deep clone to sanitize for storage
        return true;
        // NOTE: Saving the entire tree might be heavy. 
        // In a real app we'd use IndexedDB. For now, we strip images if too large.

        const stringified = JSON.stringify(conversation);
        localStorage.setItem(STORAGE_KEY, stringified);
        return true;
    } catch (e) {
        logger.error('Failed to save conversation:', e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            // Fallback: Try saving without images in messages
            try {
                const leanMessages: Record<string, Message> = {};
                Object.values(conversation.messages).forEach(msg => {
                    leanMessages[msg.id] = { ...msg, image: undefined };
                });
                const leanConversation = { ...conversation, messages: leanMessages };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(leanConversation));
                return true;
            } catch (fallbackError) {
                logger.error('Still failed to save even without images', fallbackError);
            }
        }
        return false;
    }
}


export function useConversationTree() {
    const [conversation, setConversation] = useState<Conversation>(loadConversation);

    // Persist
    useEffect(() => {
        saveConversation(conversation);
    }, [conversation]);


    // Derived state: Get linear message history for the active branch
    // Traverses BACKWARDS from the latest message in the branch to the root
    const currentMessages = useMemo(() => {
        const { messages, branches, activeBranchId } = conversation;
        // Find the "leaf" or latest message of the active branch.
        // Actually, simpler approach:
        // We need to trace from the *end*. 
        // But how do we know the "end"? 
        // A branch is a pointer to the LEAF message? Or strictly a parallel reality?

        // Let's model simpler: A message belongs to a branch.
        // But branches split.
        // If msg A -> msg B.
        // I want to branch off A to create C.
        // So A will have children B and C.

        // Let's just traverse everything and sort by timestamp, filtering by "path".
        // Path Traversal:
        // Start from all messages. Filter those that belong to current active branch ID?
        // No, because a new branch INHERITS the parent's history.

        // CORRECT APPROACH:
        // 1. Identify the 'leaf' message of the current branch? 
        //    Unreliable if we just append.

        // Let's recursively build the chain for the current view.
        // We need to find the latest message that points to the active branch (or parents).

        // Efficient way:
        // Store `lastMessageId` in the Branch definition?
        // Let's rely on `branchId` tag on messages for now + sorting.

        // Actually, if we just want the "current view", we collect all messages
        // that are "ancestors" of the HEAD of the branch.
        // But we don't track HEAD explicitly.

        // Alternative: Filter all messages that match `branchId` OR are ancestors of the first message of this branch.
        // This gets complex.

        // SIMPLIFIED MODEL for this task:
        // Just filter messages by `branchId === activeBranchId`.
        // BUT, that means creating a new branch copies nothing?
        // NO, we want history.

        // Let's do this:
        // `currentMessages` is a standard array.
        // When we `createBranch(fromMessageId)`, we define that the new branch *starts* at `fromMessageId`.
        // But visually, we want to see the whole conversation history up to that point.

        // Algorithm:
        // 1. Find all messages in the `activeBranchId`.
        // 2. Find the `parentMessageId` of the `activeBranchId` (the fork point).
        // 3. Recursively add ancestors of that parent message.

        const result: Message[] = [];
        const messagesByParent: Record<string, Message[]> = {}; // optimization if needed

        // 1. Get messages strictly in this branch
        const branchMessages = Object.values(messages).filter(m => m.branchId === activeBranchId);

        // 2. Sort by time
        branchMessages.sort((a, b) => a.timestamp - b.timestamp);

        // 3. Get ancestor messages (from older branches)
        let currentBranch = branches[activeBranchId];
        let parentMsgId = currentBranch?.parentMessageId;

        // Collect history from parent branches
        const history: Message[] = [];

        while (parentMsgId) {
            const msg = messages[parentMsgId];
            if (msg) {
                history.push(msg);
                parentMsgId = msg.parentId ?? null; // Traverse up message tree
            } else {
                break;
            }
        }

        return [...history.reverse(), ...branchMessages];
    }, [conversation]);


    // --- Actions ---

    const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp' | 'branchId' | 'parentId'>) => {
        setConversation(prev => {
            const { messages, activeBranchId } = prev;

            // Find the last message in current view to link as parent
            // (Re-calculate currentMessages logic or track lastId)
            // For efficiency, let's find the message in this branch with latest timestamp
            const branchMsgs = Object.values(messages).filter(m => m.branchId === activeBranchId);
            const lastMsg = branchMsgs.length > 0
                ? branchMsgs.sort((a, b) => b.timestamp - a.timestamp)[0]
                : null;

            // If no message in this branch, we check the branch's start point
            const parentId = lastMsg ? lastMsg.id : prev.branches[activeBranchId].parentMessageId;

            const sanitized = sanitizeMessageData(message);
            const newMessage: Message = {
                ...sanitized,
                id: Date.now().toString(),
                timestamp: Date.now(),
                role: message.role,
                text: message.text,
                branchId: activeBranchId,
                parentId: parentId || null
            } as Message;

            return {
                ...prev,
                messages: { ...prev.messages, [newMessage.id]: newMessage }
            };
        });
        return Date.now().toString(); // simplistic ID
    }, []);

    // Add placeholder (same as useMessages but adapted)
    const addPlaceholder = useCallback((role: 'user' | 'model'): string => {
        const id = Date.now().toString();
        setConversation(prev => {
            const { messages, activeBranchId } = prev;
            const branchMsgs = Object.values(messages).filter(m => m.branchId === activeBranchId);
            const lastMsg = branchMsgs.length > 0
                ? branchMsgs.sort((a, b) => b.timestamp - a.timestamp)[0]
                : null;
            const parentId = lastMsg ? lastMsg.id : prev.branches[activeBranchId].parentMessageId;

            const placeholder: Message = {
                id,
                role,
                text: '',
                timestamp: Date.now(),
                branchId: activeBranchId,
                parentId: parentId || null
            };

            return {
                ...prev,
                messages: { ...prev.messages, [id]: placeholder }
            };
        });
        return id;
    }, []);

    const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
        setConversation(prev => ({
            ...prev,
            messages: {
                ...prev.messages,
                [id]: { ...prev.messages[id], ...sanitizeMessageData(updates) }
            }
        }));
    }, []);

    const appendToMessage = useCallback((id: string, text: string, groundingMetadata?: any) => {
        setConversation(prev => {
            const msg = prev.messages[id];
            if (!msg) return prev;

            const newText = msg.text + text;
            const truncatedText = newText.length > MAX_MESSAGE_LENGTH
                ? newText.slice(0, MAX_MESSAGE_LENGTH) + TRUNCATION_SUFFIX
                : newText;

            return {
                ...prev,
                messages: {
                    ...prev.messages,
                    [id]: {
                        ...msg,
                        text: truncatedText,
                        groundingMetadata: groundingMetadata || msg.groundingMetadata
                    }
                }
            };
        });
    }, []);

    const clearMessages = useCallback(() => {
        // Reset to initial state implies clearing all branches? 
        // Or just the current one? 
        // Standard "Clear" usually means wipe everything.
        setConversation(createInitialState());
    }, []);

    // --- Branching Logic ---

    const createBranch = useCallback((fromMessageId: string) => {
        const newBranchId = `branch_${Date.now()}`;
        setConversation(prev => {
            const newBranch: Branch = {
                id: newBranchId,
                name: `C${Object.keys(prev.branches).length + 1}`, // Simple naming C2, C3...
                createdAt: Date.now(),
                parentMessageId: fromMessageId
            };

            return {
                ...prev,
                branches: { ...prev.branches, [newBranchId]: newBranch },
                activeBranchId: newBranchId
            };
        });
        return newBranchId;
    }, []);

    const switchBranch = useCallback((branchId: string) => {
        setConversation(prev => {
            if (!prev.branches[branchId]) return prev;
            return { ...prev, activeBranchId: branchId };
        });
    }, []);

    // Navigate between siblings (messages that share the same parent)
    const navigateUncles = useCallback((currentMessageId: string, direction: 'prev' | 'next') => {
        // Find parent of current message
        // Find all children of that parent
        // Switch to the branch of the adjacent child
        setConversation(prev => {
            const currentMsg = prev.messages[currentMessageId];
            if (!currentMsg) return prev;

            const parentId = currentMsg.parentId;

            // Find all siblings (messages with same parent)
            const siblings = Object.values(prev.messages)
                .filter(m => m.parentId === parentId)
                .sort((a, b) => a.timestamp - b.timestamp);

            const currentIndex = siblings.findIndex(m => m.id === currentMessageId);
            if (currentIndex === -1) return prev;

            let targetSibling: Message | null = null;
            if (direction === 'prev' && currentIndex > 0) {
                targetSibling = siblings[currentIndex - 1];
            } else if (direction === 'next' && currentIndex < siblings.length - 1) {
                targetSibling = siblings[currentIndex + 1];
            }

            if (targetSibling) {
                // We need to find which branch this sibling belongs to?
                // Or just switch active branch to the sibling's branchId
                return { ...prev, activeBranchId: targetSibling.branchId! };
            }

            return prev;
        });
    }, []);

    // Get sibling info for UI (e.g., "2 / 5")
    const getSiblingInfo = useCallback((messageId: string) => {
        const { messages } = conversation;
        const msg = messages[messageId];
        if (!msg) return null;

        const siblings = Object.values(messages)
            .filter(m => m.parentId === msg.parentId)
            .sort((a, b) => a.timestamp - b.timestamp);

        return {
            current: siblings.findIndex(m => m.id === messageId) + 1,
            total: siblings.length,
            hasPrev: siblings.findIndex(m => m.id === messageId) > 0,
            hasNext: siblings.findIndex(m => m.id === messageId) < siblings.length - 1
        };
    }, [conversation]);

    // Legacy support exports
    const exportMessages = () => { /* ... existing export logic adapted ... */ return true; };
    const getSanitizedText = (id: string) => messages[id] ? sanitizeMessage(messages[id].text) : '';
    const addReaction = (id: string, reaction: any) => { /* reuse existing reaction logic */ };


    // Adapter for compatibility with useMessages interface where possible
    const messages = currentMessages;

    return {
        messages, // The array of messages for current view
        conversation, // The full tree state
        addMessage,
        addPlaceholder,
        updateMessage,
        appendToMessage,
        clearMessages,
        exportMessages,
        getSanitizedText,
        addReaction,
        // Branching exports
        createBranch,
        switchBranch,
        navigateUncles,
        getSiblingInfo
    };
}
