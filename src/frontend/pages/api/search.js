// export default async function handler(req, res) {
//     const { query } = req.query;

//     try {
//         const response = await fetch('https://pdf-processor-eqvpzmlmoa-uc.a.run.app/search', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ query }),
//         });

//         if (!response.ok) {
//             throw new Error('Failed to fetch from backend');
//         }

//         const data = await response.json();
//         res.status(200).json(data);
//     } catch (error) {
//         console.error('Error querying backend:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// }

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import pinecone from 'pinecone-client';
import { pipeline } from '@xenova/transformers';

// Initialize Google Secret Manager client
const secretClient = new SecretManagerServiceClient();

async function accessSecretVersion(secretName) {
    const [version] = await secretClient.accessSecretVersion({
        name: secretName,
    });

    return version.payload.data.toString();
}

const getPineconeApiKey = async () => {
    const projectId = process.env.GCP_PROJECT_ID;
    const secretId = 'pinecone_api_key';
    const versionId = 'latest';
    const secretName = `projects/${projectId}/secrets/${secretId}/versions/${versionId}`;

    return await accessSecretVersion(secretName);
};

const model = await pipeline('feature-extraction', 'Xenova/distilbert-base-uncased');

async function convertQueryToVector(query) {
    const embeddings = await model(query);
    return embeddings[0]; // Return the vector for the single query
}

export default async function handler(req, res) {
    const { query } = req.query;

    try {
        const pineconeApiKey = await getPineconeApiKey();

        pinecone.init({
            apiKey: pineconeApiKey,
            environment: 'us-west1-gcp',
        });

        const index = pinecone.Index('document-index');

        const vector = await convertQueryToVector(query);

        const response = await index.query({
            vector,
            topK: 5,
        });

        res.status(200).json({ results: response.matches });
    } catch (error) {
        console.error('Error querying Pinecone:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}