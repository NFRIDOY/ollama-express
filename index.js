import express from 'express';
// import ollama from 'ollama';
import { Ollama } from 'ollama';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import { apiKeyAuth } from './app/middleware/apiKeyAuth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;
const SERVER_TIMEOUT = 120000; // 120 seconds for long AI responses

const allowedOrigins = [
    'http://orion-ai-nine-orpin.vercel.app',
    'https://orion-ai-nine-orpin.vercel.app',
    'http://yearningly-stemlike-shavon.ngrok-free.dev',
    'https://yearningly-stemlike-shavon.ngrok-free.dev',
    'http://localhost:9050',
    'https://localhost:9050',
    'http://localhost:3000',
    'https://localhost:3000',
    'https://h1qxq8l0-9000.asse.devtunnels.ms'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
    credentials: true
}));

app.use(bodyParser.json());

// Initialize Ollama pointing to your environment's host
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' });
const MODEL_NAME = process.env.MODEL_NAME || 'gemma4';

app.use(express.json());

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Ollama Express API API',
            version: '1.0.0',
            description: 'A local Node.js Express API leveraging Gemma 4 via Ollama',
        },
        servers: [
            {
                url: '/',
                description: 'Default relative server',
            },
            // {
            //     url: `http://localhost:${PORT}`,
            //     description: 'Local development server',
            // },
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                },
            },
        },
        security: [{ ApiKeyAuth: [] }],
    },
    // Path to the API docs (where your JSDoc comments are located)
    apis: ['./index.js'],
    // apis: ['./server.js'],
};

// Initialize swagger-jsdoc
const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI documentation at /api-docs endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// --- API Endpoints with Swagger JSDoc ---

/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: Request a standard (non-streaming) AI response
 *     description: Submits a prompt to the locally running Gemma 4 model and waits for the full text generation.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "what is the capital of Bangladesh?"
 *     responses:
 *       200:
 *         description: Successfully generated response from Gemma 4
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       400:
 *         description: Missing or invalid prompt parameter
 *       500:
 *         description: Local model connection failure
 */
app.post('/api/chat', apiKeyAuth, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Set explicit timeouts to handle long AI processing
    req.setTimeout(SERVER_TIMEOUT);
    res.setTimeout(SERVER_TIMEOUT);

    try {
        const response = await ollama.chat({
            model: MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
        });
        console.log("AI: ", response);
        console.log("AI message: ", response.message.content);
        res.json({ reply: (response.message.content) });
        // res.json({ reply: marked.parse(response.message.content) });
    } catch (error) {
        console.error('Ollama Error:', error);
        res.status(500).json({ error: 'Failed to communicate with local model.' });
    }
});


/**
 * @openapi
 * /api/chat/stream:
 *   post:
 *     summary: Stream an AI response in real time
 *     description: Establishes a text/event-stream connection to chunk-feed token outputs from Gemma 4 directly to the client.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "Tell me a short story about an AI."
 *     responses:
 *       200:
 *         description: A continuous text stream of model responses.
 *       400:
 *         description: Missing or invalid prompt parameter
 *       500:
 *         description: Local streaming connection failure
 */
app.post('/api/chat/stream', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Set explicit timeouts for streaming responses
    req.setTimeout(SERVER_TIMEOUT);
    res.setTimeout(SERVER_TIMEOUT);

    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await ollama.chat({
            model: MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
            stream: true
        });

        for await (const chunk of responseStream) {
            res.write(chunk.message.content);
        }
        res.end();
    } catch (error) {
        console.error('Ollama Streaming Error:', error);
        res.status(500).write('Error occurred during stream generation.');
        res.end();
    }
});

/**
 * @openapi
 * /api/hi:
 *   get:
 *     summary: Simple test endpoint
 *     description: Returns a hello message with the provided prompt.
 *     parameters:
 *       - in: query
 *         name: prompt
 *         required: true
 *         schema:
 *           type: string
 *           example: "Ping"
 *     responses:
 *       200:
 *         description: Successfully returned hello message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       400:
 *         description: Missing or invalid prompt parameter
 */
app.get('/api/hi', async (req, res) => {
    const { prompt } = req.query;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    res.json({ reply: `Hello! You sent the prompt: ${prompt}` });
});



// Function to verify and auto-pull the model if missing from local Ollama service
async function ensureModelExists() {
    try {
        console.log(`Checking if model '${MODEL_NAME}' is available on Ollama...`);
        const response = await ollama.list();
        const models = response.models || [];
        const modelExists = models.some(m => m.name === MODEL_NAME || m.model === MODEL_NAME);

        if (!modelExists) {
            console.log(`Model '${MODEL_NAME}' not found locally. Initiating pull...`);
            await ollama.pull({ model: MODEL_NAME });
            console.log(`Successfully pulled model '${MODEL_NAME}'!`);
        } else {
            console.log(`Model '${MODEL_NAME}' is ready.`);
        }
    } catch (error) {
        console.warn(`Warning: Failed to verify/pull model '${MODEL_NAME}' automatically:`, error.message);
        console.warn('Please ensure Ollama is running and accessible.');
    }
}

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    await ensureModelExists();
});