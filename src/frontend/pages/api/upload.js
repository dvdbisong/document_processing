// pages/api/upload.js

import { Storage } from '@google-cloud/storage';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import crypto from 'crypto';

export const config = {
    api: {
        bodyParser: false,
    },
};

const storage = new Storage();
const bucket = storage.bucket('arteria-pdf-bucket');

async function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const form = new IncomingForm({
        keepExtensions: true,
        multiples: true,
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Error parsing form:', err);
            return res.status(500).json({ error: 'Error uploading files' });
        }

        const results = [];

        try {
            const fileArrays = Object.values(files);
            for (const fileArray of fileArrays) {
                const filesInArray = Array.isArray(fileArray) ? fileArray : [fileArray];
                for (const file of filesInArray) {
                    if (!file.originalFilename) {
                        results.push({ filename: 'Unknown', error: 'File name is missing' });
                        continue;
                    }

                    console.log(`Uploading file: ${file.originalFilename}, Size: ${file.size} bytes`);

                    try {
                        const fileHashBeforeUpload = await calculateFileHash(file.filepath);
                        console.log(`File hash before upload: ${fileHashBeforeUpload}`);

                        const blob = bucket.file(file.originalFilename);
                        const blobStream = blob.createWriteStream();

                        await new Promise((resolve, reject) => {
                            fs.createReadStream(file.filepath)
                                .pipe(blobStream)
                                .on('error', reject)
                                .on('finish', resolve);
                        });

                        const [metadata] = await blob.getMetadata();
                        console.log(`Uploaded file size: ${metadata.size} bytes`);

                        if (parseInt(metadata.size) !== file.size) {
                            throw new Error('File size mismatch after upload');
                        }

                        const tempDownloadPath = `/tmp/${file.originalFilename}`;
                        await blob.download({ destination: tempDownloadPath });

                        const fileHashAfterUpload = await calculateFileHash(tempDownloadPath);
                        console.log(`File hash after upload: ${fileHashAfterUpload}`);

                        if (fileHashBeforeUpload !== fileHashAfterUpload) {
                            throw new Error('File integrity check failed');
                        }

                        fs.unlinkSync(file.filepath);
                        fs.unlinkSync(tempDownloadPath);

                        console.log(`File ${file.originalFilename} uploaded and verified successfully`);
                        results.push({ filename: file.originalFilename, status: 'Success' });
                    } catch (error) {
                        console.error(`Error uploading ${file.originalFilename}:`, error);
                        results.push({ filename: file.originalFilename, error: error.message });
                    }
                }
            }

            res.status(200).json({ message: 'File upload process completed', results });
        } catch (error) {
            console.error('Error in upload process:', error);
            res.status(500).json({ error: 'Error in upload process', results });
        }
    });
}