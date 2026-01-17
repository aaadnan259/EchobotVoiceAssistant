import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

async function test() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Key first 4 chars:", key ? key.substring(0, 4) : "None");

    const genAI = new GoogleGenerativeAI(key);

    const modelsToTry = ["gemini-1.5-flash", "models/gemini-1.5-flash", "gemini-pro", "models/gemini-pro"];

    for (const modelName of modelsToTry) {
        console.log(`\nTesting model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log("SUCCESS! Response:", response.text());
            return;
        } catch (e) {
            console.log("FAILED:", e.message.split('\n')[0]);
        }
    }
}

test();
