import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useEffect, useRef } from "react";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("doc");
  const mermaidRef = useRef(null);

  useEffect(() => {
    if (result && activeTab === "diagram" && mermaidRef.current) {
      import("mermaid").then((m) => {
        m.default.initialize({ startOnLoad: false, theme: "dark" });
        m.default.render("arch-diagram", result.diagram).then(({ svg }) => {
          if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
        });
      });
    }
  }, [result, activeTab]);

  const analyze = async () => {
    if (!repoUrl) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await axios.post("http://localhost:8080/analyze", { repoUrl });
      setResult(res.data);
    } catch (err) {
      setError("Something went wrong. Check the repo URL and try again.");
    }
    setLoading(false);
  };

  const exportPDF = async () => {
    const element = document.getElementById("onboarding-doc");
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#161b22" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${result.repo}-onboarding.pdf`);
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.title}>CodeboardAI</h1>
        <p style={styles.subtitle}>
          Paste any public GitHub repo — get a full developer onboarding doc and architecture diagram in seconds.
        </p>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            type="text"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
          />
          <button style={styles.button} onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Generate Docs →"}
          </button>
        </div>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      {loading && (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Reading codebase and generating onboarding doc + architecture diagram...</p>
        </div>
      )}

      {result && (
        <div style={styles.resultContainer}>
          <div style={styles.repoCard}>
            <h2 style={styles.repoName}>{result.repo}</h2>
            <p style={styles.repoDesc}>{result.description || "No description provided"}</p>
            <div style={styles.badges}>
              <span style={styles.badge}>{result.stars} stars</span>
              <span style={styles.badge}>{result.language}</span>
              <span style={styles.badge}>{result.filesAnalyzed} files analyzed</span>
            </div>
          </div>

          <div style={styles.tabs}>
            <button
              style={activeTab === "doc" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("doc")}
            >
              Onboarding Document
            </button>
            <button
              style={activeTab === "diagram" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("diagram")}
            >
              Architecture Diagram
            </button>
          </div>

          {activeTab === "doc" && (
            <div style={styles.docBox} id="onboarding-doc">
              <div style={styles.docHeader}>
                <h3 style={styles.docTitle}>Onboarding Document</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    style={styles.copyBtn}
                    onClick={() => navigator.clipboard.writeText(result.onboardingDoc)}
                  >
                    Copy Doc
                  </button>
                  <button style={styles.pdfBtn} onClick={exportPDF}>
                    Export PDF
                  </button>
                </div>
              </div>
              <div style={styles.markdown}>
                <ReactMarkdown>{result.onboardingDoc}</ReactMarkdown>
              </div>
            </div>
          )}

          {activeTab === "diagram" && (
            <div style={styles.docBox}>
              <div style={styles.docHeader}>
                <h3 style={styles.docTitle}>Architecture Diagram</h3>
              </div>
              <div ref={mermaidRef} style={styles.diagram} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "0 20px 60px",
  },
  hero: {
    maxWidth: "800px",
    margin: "0 auto",
    paddingTop: "80px",
    textAlign: "center",
  },
  title: {
    fontSize: "52px",
    fontWeight: "800",
    background: "linear-gradient(90deg, #58a6ff, #a371f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "16px",
  },
  subtitle: {
    fontSize: "18px",
    color: "#8b949e",
    marginBottom: "40px",
    lineHeight: "1.6",
  },
  inputRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  input: {
    width: "480px",
    padding: "14px 18px",
    borderRadius: "10px",
    border: "1px solid #30363d",
    backgroundColor: "#161b22",
    color: "#e6edf3",
    fontSize: "15px",
    outline: "none",
  },
  button: {
    padding: "14px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(90deg, #58a6ff, #a371f7)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
  },
  error: {
    color: "#f85149",
    marginTop: "16px",
  },
  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "60px",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #30363d",
    borderTop: "4px solid #58a6ff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#8b949e",
    fontSize: "15px",
  },
  resultContainer: {
    maxWidth: "860px",
    margin: "50px auto 0",
  },
  repoCard: {
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
  },
  repoName: {
    fontSize: "22px",
    fontWeight: "700",
    marginBottom: "8px",
  },
  repoDesc: {
    color: "#8b949e",
    marginBottom: "16px",
  },
  badges: {
    display: "flex",
    gap: "10px",
  },
  badge: {
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "13px",
    color: "#58a6ff",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  tab: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #30363d",
    backgroundColor: "#161b22",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "14px",
  },
  tabActive: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(90deg, #58a6ff, #a371f7)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
  },
  docBox: {
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "12px",
    padding: "24px",
  },
  docHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  docTitle: {
    fontSize: "18px",
    fontWeight: "700",
  },
  copyBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    cursor: "pointer",
    fontSize: "13px",
  },
  pdfBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(90deg, #58a6ff, #a371f7)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
  },
  markdown: {
    lineHeight: "1.8",
    color: "#c9d1d9",
  },
  diagram: {
    overflowX: "auto",
    padding: "20px 0",
  },
};