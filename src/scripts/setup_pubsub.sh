#!/bin/bash
set -e

# Create Pub/Sub topic
gcloud pubsub topics create new-pdf-uploaded

# Create Cloud Storage notification
gsutil notification create -t new-pdf-uploaded -f json gs://arteria-pdf-bucket

# Create service account
gcloud iam service-accounts create pdf-processor-sa --display-name "PDF Processor Service Account"

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe pdf-processor --platform managed --region us-central1 --format 'value(status.url)')

# Create Pub/Sub subscription
gcloud pubsub subscriptions create pdf-processor-sub --topic new-pdf-uploaded \
--push-endpoint=$SERVICE_URL \
--push-auth-service-account=pdf-processor-sa@ebisong-sandbox.iam.gserviceaccount.com

# Grant permissions
gcloud run services add-iam-policy-binding pdf-processor \
--member=serviceAccount:pdf-processor-sa@ebisong-sandbox.iam.gserviceaccount.com \
--role=roles/run.invoker \
--platform managed \
--region us-central1

gcloud projects add-iam-policy-binding ebisong-sandbox \
--member=serviceAccount:pdf-processor-sa@ebisong-sandbox.iam.gserviceaccount.com \
--role=roles/pubsub.publisher

echo "Pub/Sub setup complete."