"""
RAG Service: Retrieves relevant therapist examples from dataset using FAISS + Sentence Transformers.
Used for few-shot prompting to improve response quality.
"""
import json, logging, os
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import numpy as np

try:
    import faiss
    from sentence_transformers import SentenceTransformer
except ImportError:
    raise ImportError("Please install faiss-cpu and sentence-transformers: pip install faiss-cpu sentence-transformers")

from app.core.config import settings

log = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.model = None
        self.faiss_index = None
        self.examples = []
        self.initialized = False
        self.embedding_dim = None
        
    def initialize(self) -> bool:
        """Lazy initialization: Load dataset, build embeddings, and create FAISS index"""
        if self.initialized:
            return True
            
        try:
            log.info("Initializing RAG service...")
            
            # 1. Load dataset
            self.examples = self._load_dataset()
            if not self.examples:
                log.warning("No examples loaded from dataset")
                return False
            
            log.info(f"Loaded {len(self.examples)} examples from dataset")
            
            # 2. Load embedding model
            self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            log.info(f"Loaded embedding model: {settings.EMBEDDING_MODEL} (dim: {self.embedding_dim})")
            
            # 3. Build or load FAISS index
            self._build_or_load_index()
            
            self.initialized = True
            log.info("RAG service initialized successfully")
            return True
            
        except Exception as e:
            log.error(f"Failed to initialize RAG service: {e}", exc_info=True)
            return False
    
    def _load_dataset(self) -> List[Dict]:
        """Load conversations from JSONL dataset"""
        dataset_path = Path(settings.DATASET_PATH)
        
        if not dataset_path.exists():
            log.error(f"Dataset not found: {dataset_path}")
            return []
        
        examples = []
        try:
            with open(dataset_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        examples.append(json.loads(line))
            return examples
        except Exception as e:
            log.error(f"Error loading dataset: {e}")
            return []
    
    def _build_or_load_index(self) -> None:
        """Build FAISS index from examples or load from disk"""
        faiss_path = Path(settings.FAISS_INDEX_PATH)
        index_file = faiss_path / "index.faiss"
        metadata_file = faiss_path / "metadata.json"
        
        # Try to load existing index
        if index_file.exists() and metadata_file.exists():
            try:
                self.faiss_index = faiss.read_index(str(index_file))
                log.info(f"Loaded existing FAISS index from {index_file}")
                return
            except Exception as e:
                log.warning(f"Failed to load existing index: {e}. Rebuilding...")
        
        # Build index from scratch
        log.info("Building FAISS index from examples...")
        embeddings = self._embed_examples(self.examples)
        
        # Create FAISS index
        self.faiss_index = faiss.IndexFlatL2(self.embedding_dim)
        self.faiss_index.add(embeddings)
        
        # Save index and metadata
        try:
            faiss_path.mkdir(parents=True, exist_ok=True)
            faiss.write_index(self.faiss_index, str(index_file))
            log.info(f"Saved FAISS index to {index_file}")
        except Exception as e:
            log.warning(f"Failed to save FAISS index: {e}")
    
    def _embed_examples(self, examples: List[Dict]) -> np.ndarray:
        """Embed all examples using sentence transformer"""
        texts = []
        for ex in examples:
            # Create embedding text: emotion + situation + first user message
            emotion = ex.get("emotion", "unknown")
            situation = ex.get("situation", "")
            first_msg = ""
            if ex.get("conversation") and len(ex["conversation"]) > 0:
                first_msg = ex["conversation"][0].get("content", "")
            
            text = f"{emotion} {situation} {first_msg}".strip()
            texts.append(text)
        
        log.info(f"Embedding {len(texts)} examples...")
        embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        embeddings = embeddings.astype('float32')
        return embeddings
    
    def retrieve(self, user_message: str, emotion: str = "", situation: str = "", 
                k: int = None) -> List[Dict]:
        """
        Retrieve top-k relevant therapist examples based on user message and context.
        
        Args:
            user_message: Current user message
            emotion: Detected emotion label
            situation: Detected situation/context
            k: Number of examples to retrieve (defaults to settings.RAG_TOP_K)
        
        Returns:
            List of relevant examples with therapist responses
        """
        if not self.initialized:
            if not self.initialize():
                return []
        
        if k is None:
            k = settings.RAG_TOP_K
        
        # Limit k to available examples
        k = min(k, len(self.examples))
        
        try:
            # Create query embedding
            query_text = f"{emotion} {situation} {user_message}".strip()
            query_embedding = self.model.encode([query_text], convert_to_numpy=True).astype('float32')
            
            # Search FAISS index
            distances, indices = self.faiss_index.search(query_embedding, k)
            
            # Retrieve and format results
            results = []
            for idx in indices[0]:
                if idx >= 0 and idx < len(self.examples):
                    example = self.examples[int(idx)]
                    results.append(self._format_example(example))
            
            return results
            
        except Exception as e:
            log.error(f"Error retrieving examples: {e}", exc_info=True)
            return []
    
    def _format_example(self, example: Dict) -> Dict:
        """Format an example for use in few-shot prompting"""
        return {
            "id": example.get("id"),
            "emotion": example.get("emotion"),
            "personality": example.get("personality"),
            "situation": example.get("situation"),
            "flow_type": example.get("flow_type"),
            "conversation": example.get("conversation", [])
        }
    
    def get_few_shot_text(self, examples: List[Dict], max_turns: int = 3) -> str:
        """
        Format examples as few-shot prompt text.
        
        Args:
            examples: List of retrieved examples
            max_turns: Maximum conversation turns to include per example
        
        Returns:
            Formatted text for inclusion in system prompt
        """
        if not examples:
            return ""
        
        few_shot_parts = []
        few_shot_parts.append("SIMILAR SITUATIONS & THERAPIST RESPONSES:")
        few_shot_parts.append("=" * 50)
        
        for i, ex in enumerate(examples[:2], 1):  # Limit to 2 examples to avoid token bloat
            emotion = ex.get("emotion", "unknown")
            situation = ex.get("situation", "unknown")
            few_shot_parts.append(f"\nExample {i}: {emotion.title()} - {situation.title()}")
            few_shot_parts.append("-" * 40)
            
            conversation = ex.get("conversation", [])
            turn_count = 0
            
            for msg in conversation:
                if turn_count >= max_turns:
                    break
                    
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                
                if role == "user":
                    few_shot_parts.append(f"User: {content}")
                elif role == "therapist":
                    few_shot_parts.append(f"Therapist: {content}")
                    turn_count += 1
        
        few_shot_parts.append("\n" + "=" * 50)
        return "\n".join(few_shot_parts)

# Global instance (lazy-loaded)
_rag_service = None

def get_rag_service() -> RAGService:
    """Get or create global RAG service instance"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service

def retrieve_examples(user_message: str, emotion: str = "", situation: str = "", 
                     k: int = None) -> List[Dict]:
    """Convenience function to retrieve examples"""
    service = get_rag_service()
    return service.retrieve(user_message, emotion, situation, k)

def get_few_shot_prompt(user_message: str, emotion: str = "", situation: str = "",
                        k: int = None) -> str:
    """Convenience function to get formatted few-shot prompt"""
    service = get_rag_service()
    examples = service.retrieve(user_message, emotion, situation, k)
    return service.get_few_shot_text(examples)
