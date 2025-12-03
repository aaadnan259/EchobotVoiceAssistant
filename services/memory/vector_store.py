import chromadb
from chromadb.utils import embedding_functions
from typing import List, Dict
import os
from config.loader import ConfigLoader
from utils.logger import logger

class MemoryService:
    def __init__(self):
        self.db_path = ConfigLoader.get("storage.vector_db_path", "storage/db/chroma")
        os.makedirs(self.db_path, exist_ok=True)
        
        self.client = chromadb.PersistentClient(path=self.db_path)
        
        # Use default embedding function (all-MiniLM-L6-v2)
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        
        self.collection = self.client.get_or_create_collection(
            name="echobot_memory",
            embedding_function=self.embedding_fn
        )

    def add(self, text: str, metadata: Dict = None, doc_id: str = None):
        """Add a memory."""
        if doc_id is None:
            import uuid
            doc_id = str(uuid.uuid4())
            
        try:
            self.collection.add(
                documents=[text],
                metadatas=[metadata or {}],
                ids=[doc_id]
            )
            logger.debug(f"Memory added: {text[:30]}...")
        except Exception as e:
            logger.error(f"Error adding memory: {e}")

    def query(self, query_text: str, n_results: int = 3) -> List[str]:
        """Retrieve relevant memories."""
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            return results['documents'][0] if results['documents'] else []
        except Exception as e:
            logger.error(f"Error querying memory: {e}")
            return []
