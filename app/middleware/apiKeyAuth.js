// security middleware
export const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key']; // custom header
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
}
