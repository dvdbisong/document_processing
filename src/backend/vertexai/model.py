# src/backend/vertexai

import json
import logging
from google.cloud import storage, firestore, secretmanager
from unstructured.partition.pdf import partition_pdf
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
import PyPDF2

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize clients
storage_client = storage.Client()
db = firestore.Client()
logger.info("Initialized Google Cloud clients")


# Initialize Pinecone
def init_pinecone():
    logger.info("Initializing Pinecone")
    secret_client = secretmanager.SecretManagerServiceClient()
    secret_name = f"projects/ebisong-sandbox/secrets/pinecone_api_key/versions/latest"
    response = secret_client.access_secret_version(request={"name": secret_name})
    pinecone_api_key = response.payload.data.decode("UTF-8")
    logger.info("Pinecone API key retrieved from Secret Manager")
    return Pinecone(api_key=pinecone_api_key)


pc = init_pinecone()
index = pc.Index("document-index")
logger.info("Pinecone index initialized")

# Initialize SentenceTransformer model
model = SentenceTransformer("all-MiniLM-L6-v2")
logger.info("SentenceTransformer model initialized")


def extract_text_from_pdf(file_path):
    logger.info(f"Extracting text from PDF: {file_path}")
    with open(file_path, "rb") as file:
        pdf = PyPDF2.PdfReader(file)
        text = ""
        for page in pdf.pages:
            text += page.extract_text() or ""
    logger.info(f"Extracted {len(text)} characters from PDF")
    return text


def process_document(file_path):
    logger.info(f"Processing document: {file_path}")
    try:
        elements = partition_pdf(file_path, strategy="hi_res")
        text_chunks = [element.text for element in elements if element.text]
        logger.info(
            f"Partitioned PDF into {len(text_chunks)} chunks using hi_res strategy"
        )
    except Exception as e:
        logger.warning(
            f"Failed to partition PDF: {str(e)}. Falling back to full text extraction."
        )
        full_text = extract_text_from_pdf(file_path)
        text_chunks = [full_text[i : i + 1000] for i in range(0, len(full_text), 1000)]
        logger.info(
            f"Split full text into {len(text_chunks)} chunks of 1000 characters each"
        )

    if not text_chunks:
        logger.error("No text extracted from PDF")
        raise ValueError("No text extracted from PDF")

    logger.info("Generating embeddings for text chunks")
    embeddings = model.encode(text_chunks)
    logger.info(f"Generated {len(embeddings)} embeddings")

    for i, (text_chunk, embedding) in enumerate(zip(text_chunks, embeddings)):
        doc_ref = db.collection("document_embeddings").document(f"doc_{i}")
        doc_ref.set({"text_chunk": text_chunk, "embedding_id": f"embedding_{i}"})
        logger.debug(f"Stored document chunk {i} in Firestore")
        index.upsert(vectors=[{"id": f"embedding_{i}", "values": embedding.tolist()}])
        logger.debug(f"Upserted embedding {i} to Pinecone")

    logger.info(f"Successfully processed document with {len(text_chunks)} chunks")
    return {"status": "success", "chunks_processed": len(text_chunks)}


def search(query):
    logger.info(f"Performing search with query: {query}")
    query_vector = model.encode([query])[0].tolist()
    results = index.query(vector=query_vector, top_k=5, include_values=True)
    logger.info(f"Received {len(results['matches'])} matches from Pinecone")

    matches = []
    for match in results["matches"]:
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
        else:
            logger.warning(f"Document {match['id']} not found in Firestore")

    logger.info(f"Returning {len(matches)} results")
    return {"results": matches}


def predict(instance, **kwargs):
    logger.info(f"Predict function called with instance: {instance}")
    instance = json.loads(instance)
    operation = instance.get("operation")

    if operation == "process_document":
        file_path = instance.get("file_path")
        logger.info(f"Processing document operation with file path: {file_path}")
        return process_document(file_path)
    elif operation == "search":
        query = instance.get("query")
        logger.info(f"Search operation with query: {query}")
        return search(query)
    else:
        logger.error(f"Unknown operation: {operation}")
        raise ValueError(f"Unknown operation: {operation}")
