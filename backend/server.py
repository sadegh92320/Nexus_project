# backend/server.py
from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import time, re

from backend.backend_function import \
    search_for_papers, get_connected_graph, get_connected_graph_cited_by

app = FastAPI(title="Nexus Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/search-papers")
def search_papers(q: str = Query(...)):
    """
    Search OpenAlex papers and return list of works.
    """
    t0 = time.time()
    try:
        print(f"🔎 /api/search-papers q={q!r}")
        works = search_for_papers(q)
        results = [{"title": w.get("title", "(untitled)"), "id": w.get("id"), "work": w} for w in works]
        print(f"✅ /api/search-papers {len(results)} results in {time.time()-t0:.2f}s")
        return {"results": results}
    except Exception as e:
        print(f"❌ /api/search-papers failed after {time.time()-t0:.2f}s: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/paper-graph")
def paper_graph_from_work(work: Dict[str, Any] = Body(..., embed=True)):
    """
    Expects a FULL OpenAlex work (from /api/search-papers result).
    """
    t0 = time.time()
    print("📥 /api/paper-graph POST")
    if not isinstance(work, dict):
        return JSONResponse(status_code=400, content={"error": "Body must be { work: <object> }"})

    title = work.get("title")
    wid   = work.get("id")
    print(f"   id={wid!r}  title={title!r}")

    # Normalize references
    refs_urls: List[str] = work.get("referenced_works") or []
    if refs_urls and not work.get("referenced_works_count"):
        work["referenced_works_count"] = len(refs_urls)

    if refs_urls:
        def to_openalex_id(url: str) -> str:
            m = re.search(r"/(W[0-9X]+)$", url.strip())
            return m.group(1) if m else url
        work["__referenced_ids"] = [to_openalex_id(u) for u in refs_urls]
        print(f"   normalized {len(work['__referenced_ids'])} referenced IDs from URLs")

    try:
        graph_json = get_connected_graph(work)
        took = time.time() - t0
        print(f"✅ /api/paper-graph done in {took:.2f}s nodes={len(graph_json.get('nodes', []))}")
        return graph_json
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ /api/paper-graph FAILED after {time.time()-t0:.2f}s: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})



@app.post("/api/paper-graph/cited-by")
def paper_graph_from_work(work: Dict[str, Any] = Body(..., embed=True)):
    """
    Expects a FULL OpenAlex work (from /api/search-papers result).
    """
    t0 = time.time()
    print("📥 /api/paper-graph/cited-by POST")
    if not isinstance(work, dict):
        return JSONResponse(status_code=400, content={"error": "Body must be { work: <object> }"})

    title = work.get("title")
    wid   = work.get("id")
    print(f"   id={wid!r}  title={title!r}")

    # Normalize references
    refs_urls: List[str] = work.get("referenced_works") or []
    if refs_urls and not work.get("referenced_works_count"):
        work["referenced_works_count"] = len(refs_urls)

    if refs_urls:
        def to_openalex_id(url: str) -> str:
            m = re.search(r"/(W[0-9X]+)$", url.strip())
            return m.group(1) if m else url
        work["__referenced_ids"] = [to_openalex_id(u) for u in refs_urls]
        print(f"   normalized {len(work['__referenced_ids'])} referenced IDs from URLs")

    try:
        graph_json = get_connected_graph_cited_by(work)
        took = time.time() - t0
        print(f"✅ /api/paper-graph done in {took:.2f}s nodes={len(graph_json.get('nodes', []))}")
        return graph_json
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ /api/paper-graph FAILED after {time.time()-t0:.2f}s: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})



@app.post("/api/paper-graph/recommendation")
def recommendation_graph_from_work(work: Dict[str, Any] = Body(..., embed=True)):
    """
    Expects a FULL OpenAlex work (from /api/search-papers result).
    """
    t0 = time.time()
    print("📥 /api/paper-graph/cited-by POST")
    if not isinstance(work, dict):
        return JSONResponse(status_code=400, content={"error": "Body must be { work: <object> }"})

    title = work.get("title")
    wid   = work.get("id")
    print(f"   id={wid!r}  title={title!r}")

    # Normalize references
    refs_urls: List[str] = work.get("referenced_works") or []
    if refs_urls and not work.get("referenced_works_count"):
        work["referenced_works_count"] = len(refs_urls)

    if refs_urls:
        def to_openalex_id(url: str) -> str:
            m = re.search(r"/(W[0-9X]+)$", url.strip())
            return m.group(1) if m else url
        work["__referenced_ids"] = [to_openalex_id(u) for u in refs_urls]
        print(f"   normalized {len(work['__referenced_ids'])} referenced IDs from URLs")

    try:
        graph_json = get_connected_graph(work)
        took = time.time() - t0
        print(f"✅ /api/paper-graph done in {took:.2f}s nodes={len(graph_json.get('nodes', []))}")
        return graph_json
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ /api/paper-graph FAILED after {time.time()-t0:.2f}s: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})