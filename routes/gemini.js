import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// Initialize Gemini client with server-side API key
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured on server');
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * POST /api/gemini/chat
 * Proxies chat requests to Gemini API, keeping the API key server-side
 * 
 * Request body:
 * - modelName: string (e.g., "gemini-2.0-flash")
 * - systemInstruction: string
 * - history: Array<{ role: string, text: string, image?: string }>
 * - newMessage: string
 * - image?: string (base64 data URI)
 */
router.post('/chat', async (req, res) => {
    try {
        const { modelName, systemInstruction, history, newMessage, images, image } = req.body; // Support legacy 'image'

        // Validate required fields
        if (!modelName || !newMessage) {
            return res.status(400).json({
                error: 'Missing required fields: modelName and newMessage are required'
            });
        }

        const ai = getAI();

        // Format history for the API
        const contents = (history || []).map(msg => {
            const parts = [{ text: msg.text }];

            // Handle multiple images (new)
            if (msg.images && Array.isArray(msg.images)) {
                msg.images.forEach(img => {
                    const [mimeType, data] = img.split(';base64,');
                    parts.unshift({
                        inlineData: {
                            mimeType: mimeType.replace('data:', ''),
                            data: data
                        }
                    });
                });
            }
            // Handle single image (legacy)
            else if (msg.image) {
                const [mimeType, data] = msg.image.split(';base64,');
                parts.unshift({
                    inlineData: {
                        mimeType: mimeType.replace('data:', ''),
                        data: data
                    }
                });
            }

            return { role: msg.role, parts };
        });

        // Construct current message parts
        const currentParts = [{ text: newMessage }];

        // Handle new multiple images
        if (images && Array.isArray(images)) {
            images.forEach(img => {
                const [mimeType, data] = img.split(';base64,');
                currentParts.unshift({
                    inlineData: {
                        mimeType: mimeType.replace('data:', ''),
                        data: data
                    }
                });
            });
        }
        // Handle legacy single image
        else if (image) {
            const [mimeType, data] = image.split(';base64,');
            currentParts.unshift({
                inlineData: {
                    mimeType: mimeType.replace('data:', ''),
                    data: data
                }
            });
        }

        // Add the new message to contents
        contents.push({ role: 'user', parts: currentParts });

        // Make the API call
        const result = await ai.models.generateContentStream({
            model: modelName,
            config: {
                systemInstruction: systemInstruction || '',
                tools: [{ googleSearch: {} }],
            },
            contents: contents
        });

        // Set up SSE (Server-Sent Events) for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Stream the response chunks
        for await (const chunk of result) {
            const text = chunk.text();
            if (text) {
                // Send as SSE format
                res.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
            }
        }

        // Signal completion
        res.write(`data: ${JSON.stringify({ text: '', done: true })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Gemini API Error:', error);

        // If headers already sent (streaming started), we can't change status
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
            res.end();
        } else {
            res.status(500).json({
                error: 'Failed to communicate with Gemini API',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

/**
 * POST /api/gemini/chat-simple
 * Non-streaming version for simpler use cases
 */
router.post('/chat-simple', async (req, res) => {
    try {
        const { modelName, systemInstruction, history, newMessage, image } = req.body;

        if (!modelName || !newMessage) {
            return res.status(400).json({
                error: 'Missing required fields: modelName and newMessage are required'
            });
        }

        const ai = getAI();

        // Format history for the API
        const contents = (history || []).map(msg => {
            const parts = [{ text: msg.text }];

            if (msg.image) {
                const [mimeType, data] = msg.image.split(';base64,');
                parts.unshift({
                    inlineData: {
                        mimeType: mimeType.replace('data:', ''),
                        data: data
                    }
                });
            }

            return { role: msg.role, parts };
        });

        // Construct current message parts
        const currentParts = [{ text: newMessage }];
        if (image) {
            const [mimeType, data] = image.split(';base64,');
            currentParts.unshift({
                inlineData: {
                    mimeType: mimeType.replace('data:', ''),
                    data: data
                }
            });
        }

        contents.push({ role: 'user', parts: currentParts });

        // Non-streaming call
        const result = await ai.models.generateContent({
            model: modelName,
            config: {
                systemInstruction: systemInstruction || '',
                tools: [{ googleSearch: {} }],
            },
            contents: contents
        });

        res.json({
            text: result.text(),
            success: true
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({
            error: 'Failed to communicate with Gemini API',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
