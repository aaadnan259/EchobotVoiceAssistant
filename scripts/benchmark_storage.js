
const mockLocalStorage = {
    data: {},
    setItem(key, value) {
        this.data[key] = value;
    },
    getItem(key) {
        return this.data[key];
    }
};

const STORAGE_KEY = 'echoBotMessages_v3';
const MAX_STORED_MESSAGES = 500;

function generateMessages(count) {
    const messages = [];
    for (let i = 0; i < count; i++) {
        messages.push({
            id: i.toString(),
            role: i % 2 === 0 ? 'user' : 'model',
            text: 'A'.repeat(1000), // ~1KB
            timestamp: Date.now()
        });
    }
    return messages;
}

function saveMessagesSync(messages) {
    const trimmedMessages = messages.slice(-MAX_STORED_MESSAGES);
    const serialized = JSON.stringify(trimmedMessages);
    mockLocalStorage.setItem(STORAGE_KEY, serialized);
}

const initialMessages = generateMessages(MAX_STORED_MESSAGES);

console.log(`Starting benchmark: 100 updates (DEBOUNCED) to a list of ${MAX_STORED_MESSAGES} messages (~1KB each)`);

const start = Date.now();
let currentMessages = [...initialMessages];

for (let i = 0; i < 100; i++) {
    currentMessages = [...currentMessages, {
        id: `new-${i}`,
        role: 'user',
        text: 'New message update ' + i,
        timestamp: Date.now()
    }];
    // In a debounced scenario, we only call saveMessages once at the end of the burst
}
saveMessagesSync(currentMessages);

const end = Date.now();
const duration = end - start;

console.log(`Total time for 100 updates (debounced to 1 write): ${duration}ms`);
