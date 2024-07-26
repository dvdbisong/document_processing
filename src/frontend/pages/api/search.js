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

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Backend request failed with status ${response.status}: ${errorText}`);
            throw new Error(`Failed to fetch from backend: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.info(`Received successful response from backend with ${data.results ? data.results.length : 0} results`);

        res.status(200).json(data);
        logger.info('Successfully sent response to client');
    } catch (error) {
        logger.error('Error querying backend:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}

// import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
// import pinecone from 'pinecone-client';
// import { pipeline } from '@xenova/transformers';

// // Initialize Google Secret Manager client
// const secretClient = new SecretManagerServiceClient();

// async function accessSecretVersion(secretName) {
//     const [version] = await secretClient.accessSecretVersion({
//         name: secretName,
//     });

//     return version.payload.data.toString();
// }

// const getPineconeApiKey = async () => {
//     const projectId = process.env.GCP_PROJECT_ID;
//     const secretId = 'pinecone_api_key';
//     const versionId = 'latest';
//     const secretName = `projects/${projectId}/secrets/${secretId}/versions/${versionId}`;

//     return await accessSecretVersion(secretName);
// };

// const model = await pipeline('feature-extraction', 'Xenova/distilbert-base-uncased');

// async function convertQueryToVector(query) {
//     const embeddings = await model(query);
//     return embeddings[0]; // Return the vector for the single query
// }

// export default async function handler(req, res) {
//     const { query } = req.query;

//     try {
//         const pineconeApiKey = await getPineconeApiKey();

//         pinecone.init({
//             apiKey: pineconeApiKey,
//             environment: 'us-west1-gcp',
//         });

//         const index = pinecone.Index('document-index');

//         const vector = await convertQueryToVector(query);

//         const response = await index.query({
//             vector,
//             topK: 5,
//         });

//         res.status(200).json({ results: response.matches });
//     } catch (error) {
//         console.error('Error querying Pinecone:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// }