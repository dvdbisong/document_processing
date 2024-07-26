# src/backend/cloudrun

import os
import logging
from fastapi import FastAPI, HTTPException, Request
from google.cloud import storage
from google.cloud import firestore
from google.cloud import secretmanager
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from pydantic import BaseModel
import uvicorn
import base64
import json
import fitz  # PyMuPDF
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize global variables
db = None
storage_client = None
index = None
model = None
project_id = "ebisong-sandbox"


@app.on_event("startup")
async def startup_event():
    global db, storage_client, index, model

    logger.info("Initializing application...")

    try:
        # Initialize Firestore and Storage clients
        db = firestore.Client(project=project_id, database="arteria-db")
        storage_client = storage.Client(project=project_id)
        logger.info("Firestore and Storage clients initialized successfully.")

        # Function to access secret manager
        def access_secret_version(project_id, secret_id, version_id="latest"):
            try:
                client = secretmanager.SecretManagerServiceClient()
                name = (
                    f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
                )
                logger.info(f"Attempting to access secret: {name}")
                response = client.access_secret_version(request={"name": name})
                return response.payload.data.decode("UTF-8")
            except Exception as e:
                logger.error(f"Error accessing secret: {str(e)}")
                raise

        # Get Pinecone API Key from Secret Manager
        secret_id = "pinecone_api_key"
        logger.info("Retrieving Pinecone API key from Secret Manager...")
        pinecone_api_key = access_secret_version(project_id, secret_id)
        logger.info("Pinecone API key retrieved successfully.")

        # Initialize Pinecone client
        logger.info("Initializing Pinecone client...")
        pc = Pinecone(api_key=pinecone_api_key)
        logger.info("Pinecone client initialized successfully.")

        # Create Pinecone index if it doesn't exist
        index_name = "document-index"
        if index_name not in pc.list_indexes().names():
            logger.info(f"Creating Pinecone index '{index_name}'...")
            pc.create_index(
                name=index_name,
                dimension=384,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            logger.info(f"Pinecone index '{index_name}' created successfully.")
        else:
            logger.info(f"Pinecone index '{index_name}' already exists.")

        # Connect to the Pinecone index
        index = pc.Index(index_name)
        logger.info(f"Connected to Pinecone index: {index_name}")

        # Initialize the Sentence Transformer model
        logger.info("Loading Sentence Transformer model...")
        model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Sentence Transformer model loaded successfully.")

    except Exception as e:
        logger.error(f"Error during application initialization: {str(e)}")
        logger.error(traceback.format_exc())
        raise


class PubSubMessage(BaseModel):
    message: dict


def partition_pdf_with_pymupdf(file_path):
    logger.info(f"Partitioning PDF with PyMuPDF: {file_path}")
    try:
        doc = fitz.open(file_path)
        text_chunks = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            # Split the text into chunks of approximately 1000 characters
            chunks = [text[i : i + 1000] for i in range(0, len(text), 1000)]
            text_chunks.extend(chunks)
        logger.info(f"Extracted {len(text_chunks)} text chunks using PyMuPDF.")
        return text_chunks
    except Exception as e:
        logger.error(f"Error partitioning PDF with PyMuPDF: {str(e)}")
        logger.error(traceback.format_exc())
        return []


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

        logger.info("Partitioning PDF...")
        text_chunks = partition_pdf_with_pymupdf(temp_file_path)

        if not text_chunks:
            logger.error("Failed to extract text from PDF.")
            return {"status": "Error", "message": "Failed to extract text from PDF"}

        logger.info("Generating embeddings...")
        embeddings = generate_embeddings(text_chunks)
        logger.info(f"Generated {len(embeddings)} embeddings.")

        logger.info("Storing embeddings in Firestore and Pinecone...")
        store_embeddings(text_chunks, embeddings)
        logger.info("Embeddings stored successfully.")

        # If we've made it this far, processing was successful
        logger.info("Document processed successfully.")
        return {"status": "OK"}

    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        logger.error(traceback.format_exc())
        # By raising an HTTPException, we ensure the message won't be acknowledged
        raise HTTPException(
            status_code=500, detail=f"Error processing document: {str(e)}"
        )


def generate_embeddings(text_chunks):
    logger.info(f"Generating embeddings for {len(text_chunks)} text chunks...")
    try:
        embeddings = model.encode(text_chunks)
        logger.info(f"Generated {len(embeddings)} embeddings successfully.")
        return embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        logger.error(traceback.format_exc())
        raise


def store_embeddings(text_chunks, embeddings):
    logger.info(f"Storing {len(embeddings)} embeddings...")
    try:
        for i, (text_chunk, embedding) in enumerate(zip(text_chunks, embeddings)):
            doc_ref = db.collection("document_embeddings").document(f"doc_{i}")
            doc_ref.set({"text_chunk": text_chunk, "embedding_id": f"embedding_{i}"})
            logger.info(f"Stored document {i} in Firestore (arteria-db).")

            index.upsert(
                vectors=[{"id": f"embedding_{i}", "values": embedding.tolist()}]
            )
            logger.info(f"Stored embedding {i} in Pinecone.")
    except Exception as e:
        logger.error(f"Error storing embeddings: {str(e)}")
        logger.error(traceback.format_exc())
        raise


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
        logger.info(f"Converting query to vector: '{query}'")
        query_vector = model.encode([query])[0].tolist()
        logger.info("Query converted to vector successfully.")

        logger.info("Querying Pinecone for top 5 results...")
        results = index.query(vector=query_vector, top_k=5, include_values=True)
        logger.info(f"Received {len(results['matches'])} matches from Pinecone.")

        matches = []
        for match in results["matches"]:
            logger.info(
                f"Fetching document {match['id']} from Firestore (arteria-db)..."
            )
            doc_ref = db.collection("document_embeddings").document(match["id"])
            doc = doc_ref.get()
            if doc.exists:
                matches.append(
                    {
                        "id": match["id"],
                        "score": match["score"],
                        "text_chunk": doc.to_dict()["text_chunk"],
                    }
                )
                logger.info(f"Added match {match['id']} to results.")
            else:
                logger.warning(f"Document {match['id']} not found in Firestore.")

        logger.info(f"Returning {len(matches)} search results.")
        return {"results": matches[:5]}

    except Exception as e:
        logger.error(f"Error during search: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/log")
async def log_request(request: Request):
    body = await request.body()
    logger.info(f"Received request: {body}")
    return {"status": "OK"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
