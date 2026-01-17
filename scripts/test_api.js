import chatHandler from './src/services/chat-handler.js';

async function runTests() {
    try {
        console.log("1. Testing Health Check...");
        const isHealthy = await chatHandler.checkHealth();
        console.log(`- Health Check Result: ${isHealthy ? 'PASSED' : 'FAILED'}`);

        if (isHealthy) {
            console.log("\n2. Testing Chat Message...");
            const start = Date.now();
            const result = await chatHandler.sendMessage("Hello, are you online?");
            const duration = Date.now() - start;

            if (result.success) {
                console.log("- Chat Test PASSED");
                console.log(`- Response: ${result.response.substring(0, 100)}...`);
                console.log(`- Duration: ${duration}ms`);
            } else {
                console.log("- Chat Test FAILED");
                console.error("- Error:", result.error);
            }
        }

    } catch (error) {
        console.error("Test Script Error:", error);
    }
}

runTests();
