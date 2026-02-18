import hashlib
import os
from typing import Any, Dict, List, Optional

import lancedb
import pyarrow as pa


class VectorDBService:
    """Centralized LanceDB service for code/document chunks."""

    def __init__(self, db_path: str = "shared_data/lancedb", table_name: str = "code_chunks"):
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:  # pragma: no cover - runtime dependency guard
            raise RuntimeError(
                "sentence-transformers is required for LanceDB embedding. "
                "Install backend requirements first."
            ) from exc

        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
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

    def clear_repo(self, repo_id: str):
        self.table.delete(f"repo_id = '{repo_id}'")

    def ingest_code_chunks(self, chunks: List[Dict[str, Any]], repo_id: str):
        if not chunks:
            return

        texts = [c.get("text", "") for c in chunks]
        vectors = self.encoder.encode(texts).tolist()

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
        query_vector = self.encoder.encode(query).tolist()
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
