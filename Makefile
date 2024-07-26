.PHONY: help deploy_cloud_run setup_pubsub build_frontend deploy_vertexai

help:
	@echo "Available commands:"
	@echo "  make deploy_cloud_run   Deploy the Cloud Run service"
	@echo "  make setup_pubsub       Setup Pub/Sub and Cloud Storage trigger"
	@echo "  make build_frontend     Build the frontend using Cloud Build"
	@echo "  make deploy_vertexai    Deploy the Vertex AI model"

deploy_cloud_run:
	@echo "Deploying Cloud Run service..."
	@bash src/scripts/deploy_cloud_run.sh

setup_pubsub:
	@echo "Setting up Pub/Sub and Cloud Storage trigger..."
	@bash src/scripts/setup_pubsub.sh

build_frontend:
	@echo "Building frontend using Cloud Build..."
	cd src/frontend && gcloud builds submit --config cloudbuild.yaml --project=ebisong-sandbox .

deploy_vertexai:
	@echo "Deploying Vertex AI model..."
	@bash src/scripts/deploy_vertexai.sh