"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const t = (localStorage.getItem("mnx-theme") as "dark" | "light") ?? "dark";
    setTheme(t);
    document.documentElement.classList.toggle("light", t === "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mnx-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  return (
    <button
      onClick={toggle}
      className="btn-ghost w-10 h-10 p-0"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
