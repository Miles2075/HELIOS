import { useState } from "react";
import BrainMap from "./brain-map/BrainMap";
import "./App.css";

// TEMPORARY TEST HARNESS — not the real HELIOS dashboard.
// It only lets you preview Brain Map in each of Krishi's four themes.
// During integration, Krishi's own App replaces this file.
const THEMES = [
  ["sakura", "Sakura Pink"],
  ["nord", "Nord Frost"],
  ["lavender", "Lavender Haze"],
  ["obsidian", "Obsidian Mono"],
];

function App() {
  const [theme, setTheme] = useState("nord");

  return (
    // Fills the whole browser window (the shared index.css limits #root's width).
    <div style={{ position: "fixed", inset: 0, overflow: "auto" }}>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        style={{
          position: "fixed",
          bottom: 12,
          right: 16,
          zIndex: 50,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #444",
          background: "#111",
          color: "#eee",
          fontSize: 12,
        }}
      >
        {THEMES.map(([key, name]) => (
          <option key={key} value={key}>
            Preview theme: {name}
          </option>
        ))}
      </select>
      <BrainMap theme={theme} />
    </div>
  );
}

export default App;