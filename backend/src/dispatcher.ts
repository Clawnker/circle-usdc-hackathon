import express from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// AgentWallet Config
const AGENTWALLET_API_URL = 'https://agentwallet.mcpay.tech/api';
const AGENTWALLET_TOKEN = process.env.AGENTWALLET_TOKEN;
const AGENTWALLET_USERNAME = process.env.AGENTWALLET_USERNAME;

/**
 * Dispatcher Logic
 * Routes prompts to specialized agents (Magos, Aura, bankr)
 */
app.post('/dispatch', async (req, res) => {
    const { prompt, userId } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // 1. Logic to determine specialist (placeholder)
        const specialist = routePrompt(prompt);
        console.log(`Routing to specialist: ${specialist}`);

        // 2. Execute call via AgentWallet x402 if needed
        // For this spike, we just stub the specialists
        const result = await callSpecialist(specialist, prompt);

        res.json({
            success: true,
            specialist,
            result
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

function routePrompt(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('magos') || lower.includes('magic')) return 'magos';
    if (lower.includes('aura') || lower.includes('vibe')) return 'aura';
    if (lower.includes('bankr') || lower.includes('trade') || lower.includes('solana')) return 'bankr';
    return 'general';
}

async function callSpecialist(specialist: string, prompt: string) {
    // Stub implementation
    return `Response from ${specialist} for: "${prompt}"`;
}

app.listen(PORT, () => {
    console.log(`CSN Dispatcher running on port ${PORT}`);
});
