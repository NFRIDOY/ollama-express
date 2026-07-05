import express from 'express';
import ollama from 'ollama';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

/**
 * Endpoint 1: Standard Response (Waits for full generation)
 */
app.post('/api/chat', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const response = await ollama.chat({
            model: 'gemma4',
            messages: [{ role: 'user', content: prompt }],
        });

        res.json({ reply: response.message.content });
    } catch (error) {
        console.error('Ollama Error:', error);
        res.status(500).json({ error: 'Failed to communicate with local model.' });
    }
});

/**
 * Endpoint 2: Streaming Response (Sends token chunks in real-time)
 */
app.post('/api/chat/stream', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // Set headers for Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await ollama.chat({
            model: 'gemma4',
            messages: [{ role: 'user', content: prompt }],
            stream: true
        });

        for await (const chunk of responseStream) {
            // Write each text chunk back to the client immediately
            res.write(chunk.message.content);
        }

        res.end();
    } catch (error) {
        console.error('Ollama Streaming Error:', error);
        res.status(500).write('Error occurred during stream generation.');
        res.end();
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api/models', async (req, res) => {
    try {
        const response = await ollama.list();
        res.json(response);
    } catch (error) {
        console.error('Ollama Error:', error);
        res.status(500).json({ error: 'Failed to communicate with local model.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});