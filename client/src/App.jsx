import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import "./App.css";

// ─── Chart colours ─────────────────────────────────────────────────────────────
const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#ef4444", "#a78bfa", "#f472b6"];

// ─── Chart renderer ────────────────────────────────────────────────────────────
function ChartBlock({ chart }) {
  if (!chart) return null;
  const { type, title, data } = chart;

  return (
    <div className="chart-block">
      <p className="chart-title">{title}</p>
      <ResponsiveContainer width="100%" height={260}>
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="label" tick={{ fill: "#a0a0b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#a0a0b8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #6366f1", borderRadius: 8 }}
              labelStyle={{ color: "#e0e0f0" }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="label" tick={{ fill: "#a0a0b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#a0a0b8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #22d3ee", borderRadius: 8 }}
              labelStyle={{ color: "#e0e0f0" }}
            />
            <Line
              type="monotone" dataKey="value" stroke="#22d3ee"
              strokeWidth={2} dot={{ fill: "#22d3ee", r: 4 }}
            />
          </LineChart>
        ) : (
          // pie
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="label"
              cx="50%" cy="50%" outerRadius={90}
              label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#1a1a2e", border: "1px solid #f59e0b", borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ color: "#a0a0b8", fontSize: 12 }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Single message bubble ──────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`message ${isUser ? "message--user" : "message--bot"}`}>
      <div className="message__avatar">{isUser ? "🧑" : "🤖"}</div>
      <div className="message__body">
        <p className="message__text">{msg.content}</p>
        {msg.chart && <ChartBlock chart={msg.chart} />}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([
    { role: "bot", content: "Bonjour ! Posez-moi une question sur vos documents.", chart: null },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Send chat message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text, chart: null }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: data.answer || data.error, chart: data.chart ?? null },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "❌ Erreur de connexion au serveur.", chart: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Upload PDF ───────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(`Ingestion de "${file.name}"…`);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("http://localhost:3001/api/ingest", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setUploadMsg(data.ok ? `✅ "${file.name}" ingéré avec succès !` : `❌ ${data.error}`);
    } catch {
      setUploadMsg("❌ Erreur lors de l'upload.");
    } finally {
      setUploading(false);
      fileRef.current.value = "";
      setTimeout(() => setUploadMsg(""), 4000);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="header__logo">⚡</span>
        <span className="header__title">Assistant RAG Local</span>
        <label className="upload-btn" title="Importer un PDF">
          {uploading ? "⏳" : "📎 PDF"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </header>

      {uploadMsg && <div className="upload-toast">{uploadMsg}</div>}

      {/* Messages */}
      <main className="messages">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && (
          <div className="message message--bot">
            <div className="message__avatar">🤖</div>
            <div className="message__body">
              <div className="typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="input-bar">
        <input
          className="input-bar__field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Posez votre question…"
          disabled={loading}
        />
        <button className="input-bar__btn" onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? "⏳" : "Envoyer →"}
        </button>
      </footer>
    </div>
  );
}

