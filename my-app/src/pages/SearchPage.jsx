import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeButton, setActiveButton] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Debug: confirm mount
  useEffect(() => {
    console.log("🔎 SearchPage mounted");
  }, []);

  const buttonColors = {
    Explore: "#4facfe",
    Paper: "#9b59b6",
    World: "#27ae60",
  };
  const searchBarColor = activeButton ? buttonColors[activeButton] : "#4facfe";

  // Background nodes
  const backgroundNodes = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    color: [
      "rgba(0, 150, 255, 0.2)",
      "rgba(0, 200, 100, 0.2)",
      "rgba(255, 200, 0, 0.2)",
    ][Math.floor(Math.random() * 3)],
  }));
  const backgroundEdges = Array.from({ length: 12 }, () => {
    const n1 = backgroundNodes[Math.floor(Math.random() * backgroundNodes.length)];
    const n2 = backgroundNodes[Math.floor(Math.random() * backgroundNodes.length)];
    return { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y };
  });

  const runSearch = async () => {
    setErrMsg("");
    if (!query.trim()) {
      console.log("⚠️ Empty query");
      return;
    }
    console.log("📡 Sending request to /api/search-papers with query:", query);
    setLoading(true);
    try {
      const res = await fetch(`/api/search-papers?q=${encodeURIComponent(query)}`);
      console.log("📩 Response status:", res.status, res.statusText);
      const data = await res.json();
      console.log("✅ Backend JSON:", data);
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      if (!Array.isArray(data.results)) {
        throw new Error("Invalid results format");
      }
      setResults(data.results);
    } catch (err) {
      console.error("❌ Fetch failed:", err);
      setErrMsg(String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch();
  };

  const handlePaperSelect = (paper) => {
    console.log("➡️ Navigating to results page with id:", paper.id);
    navigate(`/results/${encodeURIComponent(paper.id)}`, {
      state: { work: paper.work }  // 👈 include full work object
    });
  };
  
  

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        background: "white",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Background Graph */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
        {backgroundEdges.map((edge, i) => (
          <line
            key={i}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="1"
          />
        ))}
        {backgroundNodes.map((node) => (
          <circle key={node.id} cx={node.x} cy={node.y} r="7" fill={node.color} />
        ))}
      </svg>

      {/* Title */}
      <h1 style={{ fontSize: "48px", fontWeight: "bold", color: "#2C3E50", marginTop: "40px", zIndex: 1 }}>
        Nexus
      </h1>

      {/* Search Bar */}
      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "white",
          borderRadius: "40px",
          padding: "10px 20px",
          boxShadow: `0 4px 12px ${searchBarColor}55`,
          border: `2px solid ${searchBarColor}`,
          marginBottom: "20px",
          marginTop: "20px",
          zIndex: 1,
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => {
            console.log("⌨️ Query changed:", e.target.value);
            setQuery(e.target.value);
          }}
          placeholder="Search for papers..."
          style={{
            border: "none",
            outline: "none",
            width: "300px",
            fontSize: "18px",
            padding: "10px",
          }}
        />
        <button
          type="submit"
          style={{
            background: searchBarColor,
            border: "none",
            color: "white",
            padding: "10px 20px",
            borderRadius: "25px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            marginLeft: "10px",
          }}
        >
          Search
        </button>
      </form>

      {/* Option Buttons */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px", zIndex: 1 }}>
        {["Explore", "Paper", "World"].map((label) => (
          <button
            key={label}
            onClick={() => {
              console.log("🔘 Mode set:", label);
              setActiveButton(label);
            }}
            style={{
              padding: "12px 25px",
              background: activeButton === label ? buttonColors[label] : "white",
              border: `2px solid ${buttonColors[label]}`,
              color: activeButton === label ? "white" : buttonColors[label],
              fontSize: "16px",
              fontWeight: "bold",
              borderRadius: "25px",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Errors */}
      {errMsg && (
        <div style={{ color: "#b00020", background: "#ffe8e8", padding: 10, borderRadius: 8, marginBottom: 10 }}>
          {errMsg}
        </div>
      )}

      {/* Search Results */}
      <div style={{ zIndex: 1, width: "60%", maxHeight: "40vh", overflowY: "auto" }}>
        {loading && <p>Loading...</p>}
        {!loading &&
          results.map((paper, i) => (
            <div
              key={i}
              onClick={() => handlePaperSelect(paper)}
              style={{
                padding: "10px",
                marginBottom: "5px",
                borderRadius: "8px",
                background: "#f8f8f8",
                cursor: "pointer",
                border: "1px solid #ddd",
              }}
            >
              {paper.title}
            </div>
          ))}
      </div>

      {/* Slogan */}
      <p style={{ position: "absolute", bottom: "20px", fontSize: "18px", fontWeight: "500", color: "#2C3E50", opacity: 0.85, zIndex: 1 }}>
        Link. Learn. Explore
      </p>
    </div>
  );
}

export default SearchPage;
