import hashlib
import os
from typing import Any, Dict, List, Optional

import httpx
import lancedb
import pyarrow as pa


class VectorDBService:
    """Centralized LanceDB service for code/document chunks."""

    def __init__(self, db_path: str = "shared_data/lancedb", table_name: str = "code_chunks"):
        # Prefer LM Studio/OpenAI-compatible embedding endpoint so we can reuse already-downloaded models.
        self.embedding_base_url = os.getenv("EMBEDDING_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-all-minilm-l6-v2-embedding")
        self.embedding_timeout_s = float(os.getenv("EMBEDDING_TIMEOUT_S", "120"))
        self._local_encoder = None

        self.db = lancedb.connect(db_path)
        self.table_name = table_name

        schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("repo_id", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 384)),
            pa.field("text", pa.string()),
            pa.field("file_path", pa.string()),
            pa.field("start_line", pa.int32()),
            pa.field("end_line", pa.int32()),
            pa.field("type", pa.string()),
            pa.field("name", pa.string()),
        ])

        self.table = self.db.create_table(self.table_name, schema=schema, exist_ok=True)

    @staticmethod
    def build_repo_id(repo_path: str) -> str:
        normalized = os.path.abspath(repo_path).replace("\\", "/")
        return hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def _safe_chunk_id(repo_id: str, file_path: str, start_line: int, end_line: int, chunk_type: str, name: str) -> str:
        payload = f"{repo_id}|{file_path}|{start_line}|{end_line}|{chunk_type}|{name}"
        return hashlib.sha1(payload.encode("utf-8")).hexdigest()

    def _encode_with_remote(self, texts: List[str]) -> List[List[float]]:
        """Encode via OpenAI-compatible /v1/embeddings endpoint (LM Studio supported)."""
        if not texts:
            return []

        url = f"{self.embedding_base_url}/embeddings"
        payload = {
            "model": self.embedding_model,
            "input": texts,
        }

        with httpx.Client(timeout=self.embedding_timeout_s) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("data", [])
        if len(items) != len(texts):
            raise RuntimeError(f"Embedding response size mismatch: expected {len(texts)}, got {len(items)}")

        # OpenAI format includes index field; sort to guarantee order.
        ordered = sorted(items, key=lambda x: x.get("index", 0))
        vectors = [row.get("embedding") for row in ordered]
        if any(v is None for v in vectors):
            raise RuntimeError("Embedding response is missing vectors")

        return vectors

    def _encode_with_local_fallback(self, texts: List[str]) -> List[List[float]]:
        """Fallback only if remote endpoint is unavailable."""
        if self._local_encoder is None:
            from sentence_transformers import SentenceTransformer
            self._local_encoder = SentenceTransformer("all-MiniLM-L6-v2")
        return self._local_encoder.encode(texts).tolist()

    def _encode(self, texts: List[str]) -> List[List[float]]:
        try:
            return self._encode_with_remote(texts)
        except Exception as remote_exc:
            print(f"⚠️ Remote embedding failed ({remote_exc}); falling back to local sentence-transformers.")
            return self._encode_with_local_fallback(texts)

    def clear_repo(self, repo_id: str):
        self.table.delete(f"repo_id = '{repo_id}'")

    def ingest_code_chunks(self, chunks: List[Dict[str, Any]], repo_id: str):
        if not chunks:
            return

        texts = [c.get("text", "") for c in chunks]
        vectors = self._encode(texts)

        records = []
        for chunk, vector in zip(chunks, vectors):
            file_path = chunk.get("file_path", "")
            start_line = int(chunk.get("start_line", 0))
            end_line = int(chunk.get("end_line", 0))
            chunk_type = chunk.get("type", "unknown")
            name = chunk.get("name", file_path)
            records.append({
                "id": self._safe_chunk_id(repo_id, file_path, start_line, end_line, chunk_type, name),
                "repo_id": repo_id,
                "vector": vector,
                "text": chunk.get("text", ""),
                "file_path": file_path,
                "start_line": start_line,
                "end_line": end_line,
                "type": chunk_type,
                "name": name,
            })

        if records:
            self.table.add(records)

    def search(self, query: str, repo_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        query_vector = self._encode([query])[0]
        search_query = self.table.search(query_vector)
        if repo_id:
            search_query = search_query.where(f"repo_id = '{repo_id}'")
        results = search_query.limit(limit).to_pandas()
        if results.empty:
            return []
        return results.to_dict(orient="records")

    def get_file_content(self, file_path: str, repo_id: Optional[str] = None) -> Optional[str]:
        escaped_path = file_path.replace("'", "''")
        filter_expr = f"file_path = '{escaped_path}' AND type = 'file_full'"
        if repo_id:
            filter_expr += f" AND repo_id = '{repo_id}'"

        result = self.table.search().where(filter_expr).limit(1).to_pandas()
        if result.empty:
            return None
        return result.iloc[0]["text"]
