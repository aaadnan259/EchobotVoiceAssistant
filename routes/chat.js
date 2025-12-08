import express from 'express';
import geminiService from '../services/gemini-service.js';

const router = express.Router();

// Initialize on startup
geminiService.initialize();

router.post('/chat', async (req, res) => {
    try {
        const { message, conversationHistory } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                error: "Message is required"
            });
        }

        // Build context-aware prompt
        let prompt = message;
        if (conversationHistory && conversationHistory.length > 0) {
            const context = conversationHistory
                .slice(-5) // Last 5 messages for context
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            prompt = `${context}\nuser: ${message}`;
        }

        // Generate response
        const result = await geminiService.generateResponse(prompt);

        if (!result.success) {
            return res.status(500).json({
                error: result.error || "Failed to generate response"
            });
        }

        res.json({
            response: result.text,
            timestamp: result.timestamp
        });

    } catch (error) {
        console.error("Chat endpoint error:", error);
        res.status(500).json({
            error: "An unexpected error occurred. Please try again."
        });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    const isHealthy = await geminiService.healthCheck();
    res.json({
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString()
    });
});

export default router;
