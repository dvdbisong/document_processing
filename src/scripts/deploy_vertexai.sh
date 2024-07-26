#!/bin/bash
set -e

# Set variables
PROJECT_ID="ebisong-sandbox"
BUCKET_NAME="${PROJECT_ID}-vertex-model"
MODEL_NAME="pdf_processor"
ENDPOINT_NAME="pdf_processor_endpoint"
REGION="us-central1"
ARTIFACT_REGISTRY="vertex-ai-models"

# Set up a Cloud Storage bucket for the model
# Check if the bucket exists, create it if it doesn't
if ! gsutil ls -b gs://${BUCKET_NAME} > /dev/null 2>&1; then
    gsutil mb -p ${PROJECT_ID} gs://${BUCKET_NAME}
else
    echo "Bucket gs://${BUCKET_NAME} already exists."
fi

# Create model-artifacts directory in the bucket (this won't error if it already exists)
gsutil cp /dev/null gs://${BUCKET_NAME}/model-artifacts/

# Upload model files to the model-artifacts directory
gsutil -m cp -r src/backend/vertexai/* gs://${BUCKET_NAME}/model-artifacts/

# Check contents of the bucket
gsutil ls gs://${BUCKET_NAME}/model-artifacts/

# Build and push the custom container
cd src/backend/vertexai
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/vertex-ai-model:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/vertex-ai-model:latest

# Print docker image details
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}

# Deploy the model to Vertex AI
UPLOAD_OUTPUT=$(gcloud ai models upload \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --display-name=${MODEL_NAME} \
    --container-image-uri=${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/vertex-ai-model:latest \
    --artifact-uri=gs://${BUCKET_NAME}/model-artifacts \
--format="json")

# List the models and filter by the model name
MODEL_ID=$(gcloud ai models list \
    --region=$REGION \
    --project=$PROJECT_ID \
    --filter="displayName=$MODEL_NAME" \
--format="value(name)")

echo "MODEL_ID: ${MODEL_ID}"

if [ -z "$MODEL_ID" ]; then
    echo "Error: Failed to upload model. MODEL_ID is empty."
    exit 1
fi

# Create endpoint if it doesn't exist
ENDPOINT_ID=$(gcloud ai endpoints list \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --filter="displayName=${ENDPOINT_NAME}" \
--format="value(name)")

if [ -z "$ENDPOINT_ID" ]; then
    ENDPOINT_ID=$(gcloud ai endpoints create \
        --project=${PROJECT_ID} \
        --region=${REGION} \
        --display-name=${ENDPOINT_NAME} \
    --format="value(name)")
fi

echo "ENDPOINT_ID: ${ENDPOINT_ID}"

gcloud ai endpoints deploy-model "${ENDPOINT_ID}" \
--project="${PROJECT_ID}" \
--region="${REGION}" \
--model="${MODEL_ID}" \
--display-name="${MODEL_NAME}" \
--machine-type=n1-standard-4 \
# --accelerator=type=nvidia-tesla-t4,count=1 \
--min-replica-count=1 \
--max-replica-count=5

echo "Vertex AI model deployed successfully. Endpoint ID: ${ENDPOINT_ID}"