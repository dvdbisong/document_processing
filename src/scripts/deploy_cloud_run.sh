#!/bin/bash
set -e

# Change to the backend/cloudrun directory
cd src/backend/cloudrun

# Build the container image
gcloud builds submit --tag gcr.io/ebisong-sandbox/pdf-processor .

# Deploy to Cloud Run
gcloud run deploy pdf-processor \
--image gcr.io/ebisong-sandbox/pdf-processor \
--platform managed \
--region us-central1 \
--memory 2Gi \
--cpu 1 \
--timeout 540 \
--concurrency 80 \
--max-instances 10 \
--allow-unauthenticated \
--set-env-vars PROJECT_ID=ebisong-sandbox,GOOGLE_CLOUD_PROJECT=ebisong-sandbox,PYTHONUNBUFFERED=1 \
--service-account pdf-processor-sa@ebisong-sandbox.iam.gserviceaccount.com

echo "Cloud Run deployment complete."