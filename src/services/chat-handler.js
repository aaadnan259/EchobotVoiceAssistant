class ChatHandler {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async sendMessage(message, conversationHistory = []) {
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message,
                        conversationHistory
                    }),
                    signal: AbortSignal.timeout(35000) // 35 second timeout
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                return {
                    success: true,
                    response: data.response,
                    timestamp: data.timestamp
                };

            } catch (error) {
                console.error(`Attempt ${attempt}/${this.retryAttempts}:`, error);

                if (attempt === this.retryAttempts) {
                    return {
                        success: false,
                        error: this.getUserFriendlyError(error)
                    };
                }

                // Wait before retry
                await new Promise(resolve =>
                    setTimeout(resolve, this.retryDelay * attempt)
                );
            }
        }
    }

    getUserFriendlyError(error) {
        const message = error.message.toLowerCase();

        if (message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) {
            return "Network connection issue. Please check your internet and try again. Ensure backend is running.";
        } else if (message.includes("timeout")) {
            return "Request took too long. Please try again.";
        } else if (message.includes("api key")) {
            return "Service configuration error. Please contact support.";
        } else if (message.includes("quota") || message.includes("rate limit")) {
            return "Service is temporarily busy. Please wait a moment and try again.";
        }

        return "Something went wrong. Please try again in a moment.";
    }

    async checkHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            return data.status === "healthy";
        } catch (error) {
            return false;
        }
    }
}

export default new ChatHandler();
