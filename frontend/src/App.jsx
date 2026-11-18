import { useState } from "react";
import BrainMap from "./brain-map/BrainMap";
import "./App.css";

// TEMPORARY TEST HARNESS — not the real HELIOS dashboard.
// Krishi's dashboard sets these theme variables for the whole app. This file
// copies her four palettes so Brain Map can be previewed in each theme on
// this branch. During integration, Krishi's App.jsx replaces this file.
const THEMES = {
  sakura: {
    name: "Sakura Pink",
    vars: {
      "--bg": "#181016", "--canvas": "#221720", "--card": "#2a1b24",
      "--border": "rgba(245, 139, 213, .22)", "--border-strong": "rgba(245, 139, 213, .42)",
      "--text": "#f9dce8", "--text-heading": "#fff0f5", "--text-muted": "#bd91aa",
      "--primary": "#f58bd5", "--secondary": "#b298e7", "--success": "#9bd3b0",
      "--shadow": "rgba(0, 0, 0, .20)",
    },
  },
  frost: {
    name: "Nord Frost",
    vars: {
      "--bg": "#08121d", "--canvas": "#0d1a27", "--card": "#132535",
      "--border": "rgba(116, 169, 198, .18)", "--border-strong": "rgba(126, 194, 222, .40)",
      "--text": "#c4d6df", "--text-heading": "#eef5f8", "--text-muted": "#78a3ba",
      "--primary": "#83cbe7", "--secondary": "#b8a1d9", "--success": "#9bd3b0",
      "--shadow": "rgba(0, 0, 0, .18)",
    },
  },
  lavender: {
    name: "Lavender Haze",
    vars: {
      "--bg": "#15111e", "--canvas": "#1e1829", "--card": "#292039",
      "--border": "rgba(178, 152, 231, .24)", "--border-strong": "rgba(178, 152, 231, .46)",
      "--text": "#e8def6", "--text-heading": "#faf5ff", "--text-muted": "#b9a9ca",
      "--primary": "#b298e7", "--secondary": "#f58bd5", "--success": "#9bd3b0",
      "--shadow": "rgba(0, 0, 0, .22)",
    },
  },
  obsidian: {
    name: "Obsidian Mono",
    vars: {
      "--bg": "#151515", "--canvas": "#1d1d1d", "--card": "#292929",
      "--border": "rgba(255, 255, 255, .14)", "--border-strong": "rgba(255, 255, 255, .30)",
      "--text": "#d4d4d4", "--text-heading": "#ffffff", "--text-muted": "#a5a5a5",
      "--primary": "#ffffff", "--secondary": "#b3b3b3", "--success": "#b3b3b3",
      "--shadow": "rgba(0, 0, 0, .30)",
    },
  },
};

function App() {
  const [theme, setTheme] = useState("sakura");

  return (
    // Fills the whole browser window (the shared index.css limits #root to
    // 1126px; this test page breaks out of that so the map gets full room).
    <div
      style={{
        ...THEMES[theme].vars,
        background: "var(--bg)",
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 24px 0" }}>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
          }}
        >
          {Object.entries(THEMES).map(([key, t]) => (
            <option key={key} value={key}>
              Preview theme: {t.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <BrainMap />
      </div>
    </div>
  );
}

export default App;