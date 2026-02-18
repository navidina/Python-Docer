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
        base_url = os.getenv("EMBEDDING_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
        self.embedding_base_url = base_url[:-3] if base_url.endswith("/v1") else base_url
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-all-minilm-l6-v2-embedding")
        self.embedding_timeout_s = float(os.getenv("EMBEDDING_TIMEOUT_S", "120"))
        self.allow_local_fallback = os.getenv("EMBEDDING_ALLOW_LOCAL_FALLBACK", "false").lower() in {"1", "true", "yes", "on"}
        self._local_encoder = None

        self.db = lancedb.connect(db_path)
        self.base_table_name = table_name
        self.table_name = table_name
        self.table = None

    def _build_schema(self, vector_dim: int) -> pa.Schema:
        return pa.schema([
            pa.field("id", pa.string()),
            pa.field("repo_id", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), vector_dim)),
            pa.field("text", pa.string()),
            pa.field("file_path", pa.string()),
            pa.field("start_line", pa.int32()),
            pa.field("end_line", pa.int32()),
            pa.field("type", pa.string()),
            pa.field("name", pa.string()),
        ])

    def _open_or_create_table(self, name: str, vector_dim: int):
        names = set(self.db.table_names())
        if name in names:
            return self.db.open_table(name)
        schema = self._build_schema(vector_dim)
        return self.db.create_table(name, schema=schema, exist_ok=True)

    def _ensure_table(self, vector_dim: int, create_if_missing: bool = True):
        # Reuse already selected table when possible
        if self.table is not None:
            return self.table

        names = set(self.db.table_names())
        if self.base_table_name not in names:
            if not create_if_missing:
                return None
            self.table_name = self.base_table_name
            self.table = self._open_or_create_table(self.table_name, vector_dim)
            return self.table

        base_table = self.db.open_table(self.base_table_name)
        vector_field = None
        for field in base_table.schema:
            if field.name == "vector":
                vector_field = field
                break

        # If schema is unknown, fallback to base table.
        if vector_field is None:
            self.table_name = self.base_table_name
            self.table = base_table
            return self.table

        vtype = vector_field.type
        if pa.types.is_fixed_size_list(vtype) and getattr(vtype, "list_size", None) != vector_dim:
            # Existing base table was created with another embedding dimension.
            # Route to a dimension-specific table to avoid Arrow cast failures.
            self.table_name = f"{self.base_table_name}_{vector_dim}d"
            self.table = self._open_or_create_table(self.table_name, vector_dim)
            return self.table

        # Compatible schema (fixed-size same dim or variable-size list)
        self.table_name = self.base_table_name
        self.table = base_table
        return self.table

    def configure_embedding(self, base_url: Optional[str] = None, model: Optional[str] = None):
        """Configure embedding provider at runtime (from API request settings)."""
        if base_url:
            cleaned = base_url.rstrip("/")
            self.embedding_base_url = cleaned[:-3] if cleaned.endswith("/v1") else cleaned
        if model and model.strip():
            self.embedding_model = model.strip()

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

        url = f"{self.embedding_base_url}/v1/embeddings"
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

        ordered = sorted(items, key=lambda x: x.get("index", 0))
        vectors = [row.get("embedding") for row in ordered]
        if any(v is None for v in vectors):
            raise RuntimeError("Embedding response is missing vectors")

        return vectors

    def _encode_with_local_fallback(self, texts: List[str]) -> List[List[float]]:
        if self._local_encoder is None:
            from sentence_transformers import SentenceTransformer
            self._local_encoder = SentenceTransformer("all-MiniLM-L6-v2")
        return self._local_encoder.encode(texts).tolist()

    def _encode(self, texts: List[str]) -> List[List[float]]:
        try:
            return self._encode_with_remote(texts)
        except Exception as remote_exc:
            if self.allow_local_fallback:
                print(f"⚠️ Remote embedding failed ({remote_exc}); falling back to local sentence-transformers.")
                return self._encode_with_local_fallback(texts)

            raise RuntimeError(
                "Remote embedding request failed. "
                f"base_url={self.embedding_base_url}/v1, model={self.embedding_model}. "
                "Make sure LM Studio server is running and the embedding model is loaded. "
                "If you want local sentence-transformers fallback, set EMBEDDING_ALLOW_LOCAL_FALLBACK=true. "
                f"Original error: {remote_exc}"
            ) from remote_exc

    def clear_repo(self, repo_id: str):
        # clear from current table if already selected
        if self.table is not None:
            self.table.delete(f"repo_id = '{repo_id}'")
            return

        # otherwise clear from base + any dimension-specific tables
        for name in self.db.table_names():
            if name == self.base_table_name or name.startswith(f"{self.base_table_name}_"):
                self.db.open_table(name).delete(f"repo_id = '{repo_id}'")

    def ingest_code_chunks(self, chunks: List[Dict[str, Any]], repo_id: str):
        if not chunks:
            return

        texts = [c.get("text", "") for c in chunks]
        vectors = self._encode(texts)
        if not vectors:
            return

        vector_dim = len(vectors[0])
        if any(len(v) != vector_dim for v in vectors):
            raise RuntimeError("Embedding vectors have inconsistent dimensions within one batch.")

        table = self._ensure_table(vector_dim=vector_dim, create_if_missing=True)

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
            table.add(records)

    def search(self, query: str, repo_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        query_vector = self._encode([query])[0]
        table = self._ensure_table(vector_dim=len(query_vector), create_if_missing=False)
        if table is None:
            return []

        search_query = table.search(query_vector)
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

        candidate_names = [self.table_name] if self.table is not None else [self.base_table_name]
        if self.table is None:
            # check dim-specific tables as well
            for name in self.db.table_names():
                if name.startswith(f"{self.base_table_name}_"):
                    candidate_names.append(name)

        for name in dict.fromkeys(candidate_names):
            if name not in set(self.db.table_names()):
                continue
            result = self.db.open_table(name).search().where(filter_expr).limit(1).to_pandas()
            if not result.empty:
                return result.iloc[0]["text"]
        return None
