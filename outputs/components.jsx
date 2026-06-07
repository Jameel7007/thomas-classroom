/* global React */
const { useState, useEffect, useMemo, useRef } = React;

// ---- Per-level accent hues (overridden by the "theme" tweak) -------------
const THEMES = {
  spectrum: { A0: 28, A1: 70, A2: 150, B1: 245, B2: 305 },
  ocean:    { A0: 200, A1: 220, A2: 245, B1: 270, B2: 300 },
  ink:      { A0: 60, A1: 60, A2: 60, B1: 60, B2: 60 },
};
function accentVars(hue, theme) {
  const c = theme === "ink" ? 0.0 : 0.13;
  const tc = theme === "ink" ? 0.004 : 0.045;
  return {
    "--accent": `oklch(0.58 ${c} ${hue})`,
    "--accent-deep": `oklch(0.46 ${c} ${hue})`,
    "--accent-tint": `oklch(0.965 ${tc} ${hue})`,
    "--accent-soft": `oklch(0.92 ${tc} ${hue})`,
  };
}

// ---- Lesson URL helper ---------------------------------------------------
// Each item maps to lessons/{level}/{slug}.html — drop real pages there later.
function slug(text) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")        // drop parenthetical notes
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function lessonHref(code, text) {
  return `lessons/${code.toLowerCase()}/${slug(text)}.html`;
}

// ---- Highlight matched query text ---------------------------------------
function Highlight({ text, query }) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

// ---- A grammar/skill line that links to its lesson page ------------------
function LessonItem({ href, text, query }) {
  return (
    <li className="item">
      <a className="item-link" href={href}>
        <span className="item-text"><Highlight text={text} query={query} /></span>
        <span className="item-go" aria-hidden="true">→</span>
      </a>
    </li>
  );
}

// ---- A titled card holding a list ---------------------------------------
function Card({ label, index, children, wide }) {
  return (
    <section className={"card" + (wide ? " card--wide" : "")}>
      <header className="card-head">
        <span className="card-index">{index}</span>
        <h4 className="card-label">{label}</h4>
      </header>
      {children}
    </section>
  );
}

window.CurriculumUI = {
  THEMES, accentVars, slug, lessonHref, Highlight, LessonItem, Card,
};
