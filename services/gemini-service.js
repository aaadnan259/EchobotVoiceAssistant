import { GoogleGenerativeAI } from "@google/generative-ai";

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = null;
        this.requestQueue = [];
        this.isProcessing = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // 1 second between requests
    }

    async initialize() {
        try {
            this.model = this.genAI.getGenerativeModel({
                model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                },
            });
            console.log("✓ Gemini model initialized");
            return true;
        } catch (error) {
            console.error("✗ Gemini initialization failed:", error);
            return false;
        }
    }

    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }

    async generateResponse(prompt, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Rate limiting
                await this.waitForRateLimit();

                // Ensure model is initialized
                if (!this.model) {
                    await this.initialize();
                }

                // Generate response with timeout
                const result = await Promise.race([
                    this.model.generateContent(prompt),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Request timeout")), 30000)
                    )
                ]);

                const response = await result.response;
                const text = response.text();

                if (!text || text.trim().length === 0) {
                    throw new Error("Empty response from Gemini");
                }

                return {
                    success: true,
                    text: text,
                    timestamp: new Date().toISOString()
                };

            } catch (error) {
                console.error(`Attempt ${attempt}/${retries} failed:`, error.message);

                // Handle specific error types
                if (error.message.includes("quota") || error.message.includes("rate limit")) {
                    console.log("Rate limit hit, waiting 2 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else if (error.message.includes("timeout")) {
                    console.log("Request timeout, retrying...");
                } else if (error.message.includes("API key")) {
                    return {
                        success: false,
                        error: "API key is invalid or expired. Please check your configuration."
                    };
                }

                // If this was the last attempt, return error
                if (attempt === retries) {
                    return {
                        success: false,
                        error: `Failed after ${retries} attempts: ${error.message}`
                    };
                }

                // Exponential backoff
                const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
    }

    async healthCheck() {
        try {
            const result = await this.generateResponse("Hello", 1);
            return result.success;
        } catch (error) {
            return false;
        }
    }
}

// Singleton instance
const geminiService = new GeminiService();

export default geminiService;
