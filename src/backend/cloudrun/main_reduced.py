# src/backend/cloudrun

import os
import logging
from fastapi import FastAPI, HTTPException
from google.cloud import storage, aiplatform
from pydantic import BaseModel
import uvicorn
import base64
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize global variables
storage_client = None
vertex_endpoint = None


@app.on_event("startup")
async def startup_event():
    global storage_client, vertex_endpoint

    logger.info("Initializing application...")

    try:
        # Initialize Storage client
        storage_client = storage.Client()
        logger.info("Storage client initialized successfully.")

        # Initialize Vertex AI
        aiplatform.init(project="ebisong-sandbox", location="us-central1")
        vertex_endpoint = aiplatform.Endpoint(
            "projects/ebisong-sandbox/locations/us-central1/endpoints/YOUR_ENDPOINT_ID"
        )
        logger.info("Vertex AI initialized successfully.")

    except Exception as e:
        logger.error(f"Error during application initialization: {str(e)}")
        raise


class PubSubMessage(BaseModel):
    message: dict


@app.post("/")
async def process_document(pubsub_message: PubSubMessage):
    logger.info("Received request to process document.")

    try:
        if not pubsub_message.message or "data" not in pubsub_message.message:
            logger.error("Invalid Pub/Sub message format: missing data.")
            raise HTTPException(
                status_code=400, detail="Invalid Pub/Sub message format"
            )

        data = json.loads(base64.b64decode(pubsub_message.message["data"]).decode())

        bucket_name = data["bucket"]
        file_name = data["name"]
        logger.info(f"Processing document: {file_name} from bucket: {bucket_name}")

        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        temp_file_path = f"/tmp/{file_name}"
        logger.info(f"Downloading file to: {temp_file_path}")
        blob.download_to_filename(temp_file_path)
        logger.info("File downloaded successfully.")

        # Call Vertex AI to process the document
        response = vertex_endpoint.predict(
            instances=[{"operation": "process_document", "file_path": temp_file_path}]
        )

        logger.info("Document processed successfully.")
        return {"status": "OK", "response": response}

    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing document: {str(e)}"
        )


class SearchQuery(BaseModel):
    query: str


@app.post("/search")
async def search(search_query: SearchQuery):
    logger.info("Received search request.")
    query = search_query.query

    if not query:
        logger.error("No query provided in search request.")
        raise HTTPException(status_code=400, detail="No query provided")

    try:
        # Call Vertex AI to perform the search
        response = vertex_endpoint.predict(
            instances=[{"operation": "search", "query": query}]
        )

        logger.info(f"Returning search results.")
        return {"results": response}

    except Exception as e:
        logger.error(f"Error during search: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
