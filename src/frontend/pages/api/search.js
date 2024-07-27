// pages/api/search.js

import { logger } from '../../utils/logger';

export default async function handler(req, res) {
    const { query } = req.query;
    logger.info(`Received search request with query: "${query}"`);

    if (!query) {
        logger.warn('Empty query received');
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    const backendUrl = 'https://pdf-processor-eqvpzmlmoa-uc.a.run.app/search';
    logger.info(`Attempting to fetch from backend: ${backendUrl}`);

    try {
        const startTime = Date.now();
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        const endTime = Date.now();
        logger.info(`Backend request completed in ${endTime - startTime}ms`);

        const data = await response.json();

        if (!response.ok) {
            logger.error(`Backend request failed with status ${response.status}: ${JSON.stringify(data)}`);
            return res.status(response.status).json({ error: data.detail || 'An error occurred while searching' });
        }

        logger.info(`Received successful response from backend with ${data.results ? data.results.length : 0} results`);

        res.status(200).json(data);
        logger.info('Successfully sent response to client');
    } catch (error) {
        logger.error('Error querying backend:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}