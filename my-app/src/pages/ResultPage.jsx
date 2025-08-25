// src/pages/ResultPage.jsx
import React from "react";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";

/* -------------------- Error Boundary -------------------- */
class ResultErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("🛑 ResultPage render error:", error, info);
    if (this.props.onError) this.props.onError(error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong rendering the graph.</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b00020" }}>
            {String(this.state.error)}
          </pre>
          <details>
            <summary>Component stack</summary>
            <pre>{this.state.info?.componentStack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------- Page -------------------- */
function ResultPageInner() {
  const navigate = useNavigate();
  const { paperId } = useParams();
  const location = useLocation();
  const work = location.state?.work;


  // Data + UI state
  const [graphJson, setGraphJson] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [centerNode, setCenterNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Diagnostics
  const [diag, setDiag] = useState({
    method: "",
    url: "",
    status: "",
    contentType: "",
    textSnippet: "",
    durationMs: 0,
  });

  // In-page log console
  const [logs, setLogs] = useState([]);
  const addLog = (msg, obj) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}${obj ? " " + JSON.stringify(obj).slice(0, 400) : ""}`;
    console.log(msg, obj ?? "");
    setLogs((prev) => [...prev, line].slice(-200));
  };
  // capture global errors
  useEffect(() => {
    const onError = (e) => addLog("window.onerror", { message: e.message, stack: e.error?.stack });
    const onRej = (e) => addLog("unhandledrejection", { reason: String(e.reason) });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  // Layout constants
  const centerRadius = 40;
  const nodeRadius = 30;
  const [graphRadius, setGraphRadius] = useState(550);
  const subfieldAngleCompression = 0.6;

  // Resize handling
  useEffect(() => {
    addLog("📄 ResultPage mounted", { paperId, hasState: Boolean(location.state) });
    const resizeHandler = () => {
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      setGraphRadius(minDim / 1.7);
    };
    resizeHandler();
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch graph (supports POST with work OR GET by id)
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    const fetchGraph = async () => {
      setLoading(true);
      setErrMsg("");
      setGraphJson(null);
      setNodes([]);
      setCenterNode(null);

      try {
        const hasWork = !!location.state?.work;
        const method = hasWork ? "POST" : "GET";
        const url = hasWork
          ? "/api/paper-graph"
          : `/api/paper-graph?id=${encodeURIComponent(paperId || "")}`;

        addLog("📡 Fetch start", { method, url, hasWork, paperId });

        const t0 = performance.now();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s safety timeout

        const res = await await fetch("/api/paper-graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ work }), // 👈 matches server.py
        });
        
        console.log("📡 Fetching URL:", url);


        clearTimeout(timeoutId);

        const contentType = res.headers.get("content-type") || "";
        const rawText = await res.text();
        const durationMs = Math.round(performance.now() - t0);

        addLog("📩 Fetch end", { status: res.status, contentType, durationMs, preview: rawText.slice(0, 200) });

        setDiag({
          method,
          url: res.url || url,
          status: `${res.status} ${res.statusText}`,
          contentType,
          textSnippet: rawText.slice(0, 400),
          durationMs,
        });

        if (aborted) return;

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          addLog("❌ JSON parse error", { error: String(e) });
          throw new Error("Backend did not return JSON.");
        }

        if (!res.ok) {
          const msg = data?.error || `Server error: ${res.status}`;
          addLog("❌ Backend error payload", data);
          throw new Error(msg);
        }

        if (!data || !Array.isArray(data.nodes)) {
          addLog("❌ Invalid graph payload (missing nodes[])", { keys: Object.keys(data || {}) });
          throw new Error("Invalid graph payload (missing nodes[]).");
        }

        setGraphJson(data);

        // find center (by title == primary_node_id)
        const center = data.nodes.find((n) => n.title === data.primary_node_id) || null;
        const others = data.nodes.filter((n) => n.title !== data.primary_node_id);

        const norm = (n) => ({
          id: n?.id ?? n?.title ?? Math.random().toString(36).slice(2),
          title: n?.title ?? "(untitled)",
          year: n?.year ?? "",
          keywords: Array.isArray(n?.keywords) ? n.keywords : [],
          doi: n?.doi ?? "",
          citations: n?.citations ?? 0,
          topic: n?.topic ?? "",
          related_topics: Array.isArray(n?.related_topics) ? n.related_topics : [],
          domain: n?.domain ?? "Unknown",
          field: n?.field ?? "Unknown",
          subfield: n?.subfield ?? "Unknown",
          relevance: typeof n?.relevance === "number" ? n.relevance : 0.2,
        });

        const normalizedCenter = center ? norm(center) : null;
        const normalizedOthers = others.map(norm);

        // sort domain > field > subfield
        normalizedOthers.sort((a, b) => {
          if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
          if (a.field !== b.field) return a.field.localeCompare(b.field);
          return a.subfield.localeCompare(b.subfield);
        });

        setCenterNode(normalizedCenter);
        setNodes(normalizedOthers);

        window.__NEXUS_LAST_GRAPH__ = data; // for manual inspection
        addLog("✅ Graph parsed", {
          totalNodes: normalizedOthers.length + (normalizedCenter ? 1 : 0),
          center: normalizedCenter?.title,
        });
      } catch (err) {
        if (err?.name === "AbortError") {
          addLog("⚠️ Fetch aborted (timeout or route changed)");
          setErrMsg("Request aborted (timeout).");
        } else {
          addLog("❌ Graph fetch failed", { error: String(err) });
          setErrMsg(String(err));
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    if (location.state?.work || paperId) {
      fetchGraph();
    } else {
      const msg = "No input provided: neither work object nor paperId found.";
      addLog("⚠️ " + msg);
      setErrMsg(msg);
    }

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [paperId, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by subfield
  const subfieldGroups = useMemo(() => {
    const g = {};
    for (const n of nodes || []) {
      const key = n.subfield || "Unknown";
      if (!g[key]) g[key] = [];
      g[key].push(n);
    }
    return g;
  }, [nodes]);

  const subfields = useMemo(() => Object.keys(subfieldGroups), [subfieldGroups]);

  // Arrange in sectors (cluster by subfield)
  const arrangedNodes = useMemo(() => {
    try {
      const arr = [];
      let sectorIndex = 0;
      subfields.forEach((sf) => {
        const group = subfieldGroups[sf];
        if (!group?.length) return;
        const start = (sectorIndex / subfields.length) * 2 * Math.PI;
        const end = ((sectorIndex + 1) / subfields.length) * 2 * Math.PI;
        const compressed = (end - start) * subfieldAngleCompression;
        const offset = (end - start - compressed) / 2;
        group.forEach((node, i) => {
          const angle = start + offset + (i / group.length) * compressed;
          arr.push({ ...node, angle, subfield: sf });
        });
        sectorIndex++;
      });
      return arr;
    } catch (e) {
      addLog("❌ arrange error", { error: String(e) });
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subfields, subfieldGroups]);

  // To cartesian, distance by relevance
  const nodePositions = useMemo(() => {
    try {
      return (arrangedNodes || []).map((n) => {
        const rel = typeof n.relevance === "number" ? n.relevance : 0.2;
        const distance = graphRadius * (1 - rel * 0.7);
        const x = distance * Math.cos(n.angle);
        const y = distance * Math.sin(n.angle);
        return { ...n, x, y };
      });
    } catch (e) {
      addLog("❌ position error", { error: String(e) });
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangedNodes, graphRadius]);

  // Subfield circular zones
  const subfieldZones = useMemo(() => {
    try {
      return subfields.map((sf) => {
        const group = nodePositions.filter((n) => n.subfield === sf);
        if (!group.length) return { subfield: sf, x: 0, y: 0, radius: 0 };
        const cx = group.reduce((s, n) => s + n.x, 0) / group.length;
        const cy = group.reduce((s, n) => s + n.y, 0) / group.length;
        const r = Math.max(...group.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 80;
        return { subfield: sf, x: cx, y: cy, radius: r };
      });
    } catch (e) {
      addLog("❌ zone error", { error: String(e) });
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodePositions, subfields]);

  const getRelevanceColor = (s) => (s > 0.7 ? "green" : s > 0.4 ? "orange" : "red");

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw", background: "white", overflow: "hidden" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          padding: "10px 20px",
          background: "linear-gradient(135deg, #4facfe, #00f2fe)",
          color: "white",
          border: "none",
          borderRadius: "25px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 100,
        }}
      >
        NexSearch
      </button>

      {/* Debug panel (network + app logs) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#111",
          color: "#0f0",
          padding: "8px",
          fontSize: "11px",
          maxHeight: "40%",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          zIndex: 1000,
        }}
      >
        {loading ? "⏳ Loading graph...\n" : ""}
        {errMsg ? `❌ ${errMsg}\n` : ""}
        {diag.method ? `Method: ${diag.method}\n` : ""}
        {diag.url ? `URL: ${diag.url}\n` : ""}
        {diag.status ? `Status: ${diag.status}\n` : ""}
        {diag.contentType ? `Content-Type: ${diag.contentType}\n` : ""}
        {diag.durationMs ? `Duration: ${diag.durationMs} ms\n` : ""}
        {diag.textSnippet ? `Snippet: ${diag.textSnippet}\n` : ""}
        {logs.length ? `---- Logs ----\n${logs.join("\n")}` : ""}
      </div>

      {/* Subfield Zones */}
      {subfieldZones.map((zone) =>
        zone.radius > 0 ? (
          <div
            key={zone.subfield}
            style={{
              position: "absolute",
              top: `calc(50% + ${zone.y - zone.radius}px)`,
              left: `calc(50% + ${zone.x - zone.radius}px)`,
              width: `${zone.radius * 2}px`,
              height: `${zone.radius * 2}px`,
              backgroundColor: "rgba(0, 255, 0, 0.08)",
              border: "2px dashed rgba(0, 180, 0, 0.5)",
              borderRadius: "50%",
              zIndex: 0,
            }}
            title={zone.subfield}
          />
        ) : null
      )}

      {/* Center Node */}
      {centerNode ? (
        <div
          onMouseEnter={(e) => {
            setHoveredNode(centerNode);
            setTooltipPos({ x: e.clientX + 15, y: e.clientY - 30 });
          }}
          onMouseLeave={() => setHoveredNode(null)}
          onMouseMove={(e) => setTooltipPos({ x: e.clientX + 15, y: e.clientY - 30 })}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: `${hoveredNode?.id === centerNode.id ? centerRadius * 2.4 : centerRadius * 2}px`,
            height: `${hoveredNode?.id === centerNode.id ? centerRadius * 2.4 : centerRadius * 2}px`,
            backgroundColor: "rgba(255, 165, 0, 0.7)",
            borderRadius: "50%",
            cursor: "pointer",
            zIndex: 2,
          }}
          title={centerNode.title}
        />
      ) : (
        <div
          style={{ position: "absolute", top: 10, left: 10, padding: 8, background: "#fffbe6", borderRadius: 6 }}
        >
          (No center node found yet)
        </div>
      )}

      {/* Nodes + Edges */}
      {nodePositions.map((node) => {
        const startX = centerRadius * Math.cos(node.angle);
        const startY = centerRadius * Math.sin(node.angle);
        const endX = node.x - nodeRadius * Math.cos(node.angle);
        const endY = node.y - nodeRadius * Math.sin(node.angle);
        const isHovered = hoveredNode?.id === node.id;

        return (
          <div key={`${node.id}`}>
            <svg
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "0",
                height: "0",
                overflow: "visible",
                zIndex: 1,
              }}
            >
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={isHovered ? "blue" : "gray"}
                strokeWidth={isHovered ? 3 : 2}
                opacity={isHovered ? 0.9 : 0.6}
              />
            </svg>

            <div
              onMouseEnter={(e) => {
                setHoveredNode(node);
                setTooltipPos({ x: e.clientX + 15, y: e.clientY - 30 });
              }}
              onMouseLeave={() => setHoveredNode(null)}
              onMouseMove={(e) => setTooltipPos({ x: e.clientX + 15, y: e.clientY - 30 })}
              style={{
                position: "absolute",
                top: `calc(50% + ${node.y - nodeRadius}px)`,
                left: `calc(50% + ${node.x - nodeRadius}px)`,
                width: `${isHovered ? nodeRadius * 2.4 : nodeRadius * 2}px`,
                height: `${isHovered ? nodeRadius * 2.4 : nodeRadius * 2}px`,
                backgroundColor: isHovered ? "rgba(0, 0, 255, 0.8)" : "rgba(0, 0, 255, 0.5)",
                borderRadius: "50%",
                cursor: "pointer",
                zIndex: 2,
              }}
              title={node.title}
            />

            <div
              style={{
                position: "absolute",
                top: `calc(50% + ${node.y - nodeRadius - 22}px)`,
                left: `calc(50% + ${node.x - 20}px)`,
                fontSize: "12px",
                fontWeight: "bold",
                color: getRelevanceColor(node.relevance),
                background: "rgba(255,255,255,0.8)",
                padding: "2px 4px",
                borderRadius: "4px",
                zIndex: 3,
              }}
            >
              {Number.isFinite(node.relevance) ? node.relevance.toFixed(3) : "0.200"}
            </div>
          </div>
        );
      })}

      {/* Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: "fixed",
            top: tooltipPos.y,
            left: tooltipPos.x,
            background: "white",
            border: "1px solid #ccc",
            padding: "10px",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            fontSize: "14px",
            zIndex: 10,
            width: "300px",
          }}
        >
          📄 <b>Title:</b> {hoveredNode.title} <br />
          🔗 <b>DOI:</b> {hoveredNode.doi || "N/A"} <br />
          📅 <b>Year:</b> {hoveredNode.year} <br />
          📈 <b>Citations:</b> {hoveredNode.citations} <br />
          🏷 <b>Keywords:</b> {hoveredNode.keywords.join(", ") || "None"} <br />
          🌐 <b>Domain:</b> {hoveredNode.domain} <br />
          🏛 <b>Field:</b> {hoveredNode.field} <br />
          🔬 <b>Subfield:</b> {hoveredNode.subfield} <br />
          🎯 <b>Topic:</b> {hoveredNode.topic} <br />
          🔗 <b>Related Topics:</b> {hoveredNode.related_topics.join(", ") || "None"}
        </div>
      )}
    </div>
  );
}

/* Wrap page in the ErrorBoundary so render errors are shown instead of a blank screen */
export default function ResultPage() {
  console.log("🚀 ResultPage loaded");
  const [ebErr, setEbErr] = useState(null);
  return (
    <ResultErrorBoundary onError={(e) => setEbErr(e)}>
      <ResultPageInner />
      {ebErr && (
        <div style={{ position: "fixed", top: 10, right: 10, background: "#ffe8e8", color: "#b00020", padding: 8 }}>
          Render error: {String(ebErr)}
        </div>
      )}
    </ResultErrorBoundary>
  );
}
