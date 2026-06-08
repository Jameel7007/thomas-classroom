/* global React, ReactDOM, CURRICULUM, CurriculumUI */
const { useState, useEffect, useMemo, useRef } = React;
const { THEMES, accentVars, slug, lessonHref, Highlight, LessonItem, Card } = CurriculumUI;

// ---- Lesson readiness allowlist -----------------------------------------
// Only the lessons listed here are active links in the map. Every other
// grammar/vocabulary item renders a non-clickable "Soon" state, so a tutor
// never clicks into a 404 or an unfinished stub during a live lesson.
// Add a line here once a lesson page is genuinely built and reviewed.
const READY_LESSONS = new Set([
  "lessons/a0/the-verb-to-be.html",
  "lessons/a0/articles-a-an.html",
  "lessons/a0/subject-pronouns.html"
]);
function lessonReady(code, text) {
  return READY_LESSONS.has(lessonHref(code, text));
}

const SKILLS = [
{ key: "listening", label: "Listening" },
{ key: "reading", label: "Reading" },
{ key: "speaking", label: "Speaking" },
{ key: "writing", label: "Writing" }];

const SITE_TABS = [
{ key: "curriculum", label: "Curriculum" },
{ key: "quick-check", label: "Quick Level Check" },
{ key: "placement", label: "Placement Exam" },
{ key: "bio", label: "Bio" },
{ key: "languages", label: "Languages" },
{ key: "blog", label: "Blog" },
{ key: "dictionary", label: "Dictionary" }];

const ASSESSMENTS = {
  A0: {
    exit: "A0 End-of-Level Diagnostic",
    exitHref: "assessments/a0-exit.html",
    ready: true,
    purpose: "Check the complete A0 foundation, identify anything that was missed, and decide whether the learner is ready to begin A1.",
    evidence: [
      "Names and spells basic personal details.",
      "Understands slow, simple classroom English.",
      "Answers short questions with memorized chunks."
    ]
  },
  A1: {
    exit: "A1 End-of-Level Diagnostic",
    exitHref: "assessments/a1-exit.html",
    ready: false,
    purpose: "Check the complete A1 level, find any remaining gaps, and decide whether the learner is ready to begin A2.",
    evidence: [
      "Uses present simple and continuous in guided tasks.",
      "Asks and answers everyday questions.",
      "Completes short reading, listening, speaking, and writing tasks."
    ]
  },
  A2: {
    exit: "A2 End-of-Level Diagnostic",
    exitHref: "assessments/a2-exit.html",
    ready: false,
    purpose: "Check the complete A2 level, identify weak areas, and decide whether the learner is ready to begin B1.",
    evidence: [
      "Talks about past and future events with support.",
      "Compares options and gives simple reasons.",
      "Handles short functional tasks like directions, travel, and health."
    ]
  },
  B1: {
    exit: "B1 End-of-Level Diagnostic",
    exitHref: "assessments/b1-exit.html",
    ready: false,
    purpose: "Check the complete B1 level across receptive and productive skills before the learner begins B2.",
    evidence: [
      "Produces connected speech on familiar topics.",
      "Explains experiences, plans, reasons, and opinions.",
      "Understands the main points of clear standard input."
    ]
  },
  B2: {
    exit: "B2 End-of-Level Diagnostic",
    exitHref: "assessments/b2-exit.html",
    ready: false,
    purpose: "Check the complete B2 level, locate any remaining gaps, and confirm readiness for advanced independent work.",
    evidence: [
      "Develops arguments with examples and nuance.",
      "Handles longer reading and listening texts.",
      "Repairs communication and adapts register."
    ]
  }
};

const BLOG_POSTS = [
  {
    title: "Why Progress Should Be Visible",
    tag: "Assessment",
    summary: "A short article on using lesson quizzes and comprehensive end-of-level diagnostics to show real ability gained.",
    status: "Draft outline"
  },
  {
    title: "CEFR Without the Jargon",
    tag: "Curriculum",
    summary: "A teacher-friendly explanation of CEFR as a map of usable ability, not a list of grammar points.",
    status: "Draft outline"
  },
  {
    title: "The Thinking Method in English Lessons",
    tag: "Methodology",
    summary: "How guided noticing, transfer awareness, and modern TEFL drills can work together in live tutoring.",
    status: "Draft outline"
  },
  {
    title: "L1 Transfer: Spanish to English",
    tag: "Languages",
    summary: "Common Spanish-to-English transfer patterns, including para/por, conocer/saber, and age with tener.",
    status: "Draft outline"
  }
];

const TRANSFER_LANGUAGES = [
  {
    name: "Spanish",
    note: "Spanish learners often transfer useful patterns, but English needs tighter control of auxiliaries, prepositions, articles, and word order.",
    examples: [
      { source: "para / por", issue: "Overusing for in English", lesson: "for, to, by, and because" },
      { source: "conocer / saber", issue: "Mixing know a person and know a fact", lesson: "know, meet, and be familiar with" },
      { source: "tener años", issue: "Saying I have 30 years", lesson: "age with be" },
      { source: "no before verb", issue: "Dropping do in negatives", lesson: "do-support for negatives" }
    ]
  },
  {
    name: "Portuguese",
    note: "Portuguese transfer work often focuses on false friends, prepositions, auxiliary choice, and deciding when English needs an explicit subject.",
    examples: [
      { source: "ficar", issue: "Choosing stay, become, get, or be", lesson: "ficar map into English" },
      { source: "saudade / sentir falta", issue: "Choosing miss, miss out, or feel like", lesson: "miss and missing" },
      { source: "tenho 25 anos", issue: "Age with have", lesson: "age with be" },
      { source: "fazer perguntas", issue: "make vs do confusion", lesson: "make, do, and ask" }
    ]
  },
  {
    name: "Turkish",
    note: "Turkish learners often need explicit practice with articles, be, word order in questions, and tense/aspect choices that English marks differently.",
    examples: [
      { source: "no articles", issue: "Leaving out a, an, and the", lesson: "articles as meaning signals" },
      { source: "subject-object-verb", issue: "Moving English verbs too late", lesson: "English word order" },
      { source: "var / yok", issue: "Mapping existence to there is / there are", lesson: "there is and there are" },
      { source: "one broad present", issue: "Choosing present simple or continuous", lesson: "routine vs happening now" }
    ]
  }
];

const DICTIONARY_ENTRIES = {
  be: {
    word: "be",
    level: "A0",
    english: "Used to say who someone is, what something is, how someone feels, age, job, nationality, or location.",
    examples: ["I am Ana.", "She is happy.", "They are at work."],
    translations: {
      Spanish: "ser / estar",
      Portuguese: "ser / estar",
      Turkish: "olmak"
    },
    note: "English uses be for identity and temporary states. Many languages split this meaning into two or more verbs."
  },
  from: {
    word: "from",
    level: "A0",
    english: "Shows origin: the place where a person, thing, or action begins.",
    examples: ["I am from Mexico.", "This message is from Ana."],
    translations: {
      Spanish: "de",
      Portuguese: "de",
      Turkish: "-den / -dan"
    },
    note: "In introductions, teach the chunk: I am from + country/city."
  },
  name: {
    word: "name",
    level: "A0",
    english: "The word people use to identify a person, place, or thing.",
    examples: ["My name is Ana.", "What is your name?"],
    translations: {
      Spanish: "nombre",
      Portuguese: "nome",
      Turkish: "isim / ad"
    },
    note: "At A0, teach the chunk my name is before analyzing the noun."
  }
};

function matches(text, q) {
  return !q || text.toLowerCase().includes(q.toLowerCase());
}

// True if any grammar/vocab/can-do/skill line in this level matches the query.
function levelHasMatches(lvl, query) {
  if (!query) return true;
  const has = (arr) => arr.some((t) => matches(t, query));
  return has(lvl.grammar) || has(lvl.vocab) || has(lvl.canDo) ||
  SKILLS.some((s) => has(lvl.skills[s.key]));
}

// ============================ Site tabs ==================================
function SiteTabs({ active, setActive }) {
  return (
    <nav className="site-tabs" aria-label="Site sections">
      <div className="site-tabs-inner">
        {SITE_TABS.map((tab) =>
          <button key={tab.key}
            className={"site-tab" + (active === tab.key ? " is-active" : "")}
            onClick={() => setActive(tab.key)}>
            {tab.label}
          </button>
        )}
      </div>
    </nav>
  );
}

// ============================ Header ====================================
function Header() {
  const totalLessons = CURRICULUM.reduce(
    (n, l) => n + l.grammar.length + l.vocab.length, 0);
  const readyLessons = READY_LESSONS.size;
  return (
    <header className="masthead">
      <div className="mast-inner">
        <p className="overline">CEFR Framework · Reference Guide</p>
        <h1 className="title">The English<br />Curriculum Map</h1>
        <p className="welcome">Welcome to <em style={{ fontFamily: "Newsreader" }}>Thomas’s Classroom</em></p>
        <p className="lede">
          From absolute beginner to confident independence — what you study, and
          what you can actually <em>do</em>, at every level of English from
          <strong> A0</strong> through <strong>B2</strong>.
        </p>
        <div className="mast-stats">
          <span className="stat"><b>5</b> levels</span>
          <span className="stat-div" />
          <span className="stat"><b>A0–B2</b> CEFR range</span>
          <span className="stat-div" />
          <span className="stat"><b>{readyLessons}</b> of {totalLessons} lessons ready</span>
        </div>
      </div>
    </header>);

}

function CefrExplainer() {
  return (
    <section className="explainer" id="cefr">
      <div className="explainer-kicker">What CEFR means</div>
      <div className="explainer-grid">
        <div>
          <h2>CEFR is the map, not the destination.</h2>
          <p>The Common European Framework of Reference describes what a learner can actually do in a language. It is not just grammar knowledge; it is usable ability across listening, reading, speaking, and writing.</p>
        </div>
        <div className="explainer-points">
          <p><b>A levels</b> build survival communication: names, routines, needs, simple stories.</p>
          <p><b>B levels</b> build independence: opinions, explanations, work situations, travel, and longer texts.</p>
          <p><b>This curriculum</b> uses CEFR as the backbone, then adds lesson-level drills, Thinking Method noticing, and L1 transfer work.</p>
        </div>
      </div>
    </section>
  );
}

function BioTab() {
  return (
    <main className="tab-page">
      <p className="overline">Teacher Profile</p>
      <h1 className="tab-title">Personal Bio</h1>
      <p className="tab-lede">This tab is the future home for your teaching profile, methodology, classroom values, credentials, and a friendly introduction for new students.</p>
      <div className="tab-grid">
        <section className="info-panel">
          <h2>Teaching style</h2>
          <p>Warm, precise, production-heavy tutoring for adult learners. Lessons use guided noticing, clear explanations, interactive drills, and real-life speaking tasks.</p>
        </section>
        <section className="info-panel">
          <h2>Student promise</h2>
          <p>Students should leave every lesson able to say something real, not merely recognize a rule. Explanation supports production; it does not replace it.</p>
        </section>
        <section className="info-panel">
          <h2>To fill in next</h2>
          <p>Add your real bio, teaching background, languages taught, student types, and a short welcome message in your own voice.</p>
        </section>
      </div>
    </main>
  );
}

function LanguagesTab() {
  const [language, setLanguage] = useState(TRANSFER_LANGUAGES[0].name);
  const current = TRANSFER_LANGUAGES.find((l) => l.name === language);
  return (
    <main className="tab-page">
      <p className="overline">L1 Transfer Library</p>
      <h1 className="tab-title">Languages</h1>
      <p className="tab-lede">Each language tab will collect common and uncommon transfer patterns, then link into targeted English lessons for those patterns.</p>
      <div className="language-tabs">
        {TRANSFER_LANGUAGES.map((l) =>
          <button key={l.name} className={"language-tab" + (language === l.name ? " is-active" : "")}
            onClick={() => setLanguage(l.name)}>{l.name}</button>
        )}
      </div>
      <section className="language-panel">
        <h2>{current.name} → English</h2>
        <p>{current.note}</p>
        <div className="transfer-grid">
          {current.examples.map((item) =>
            <article className="transfer-card" key={item.source}>
              <span className="transfer-source">{item.source}</span>
              <h3>{item.issue}</h3>
              <p>Lesson path: <strong>{item.lesson}</strong></p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

function DictionaryTool({ compact }) {
  const [word, setWord] = useState("be");
  const [language, setLanguage] = useState("Spanish");
  const key = word.trim().toLowerCase();
  const entry = DICTIONARY_ENTRIES[key];
  return (
    <div className={compact ? "dictionary-tool compact" : "dictionary-tool"}>
      <div className="dictionary-controls">
        <label className="dictionary-input">
          <span>Word</span>
          <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Try be, from, name" />
        </label>
        <label className="dictionary-input small">
          <span>Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>Spanish</option>
            <option>Portuguese</option>
            <option>Turkish</option>
          </select>
        </label>
      </div>
      {entry ?
        <section className="dictionary-result">
          <p className="dictionary-word">{entry.word} <span>{entry.level}</span></p>
          <p>{entry.english}</p>
          <p><b>{language}:</b> {entry.translations[language]}</p>
          <ul>
            {entry.examples.map((example) => <li key={example}>{example}</li>)}
          </ul>
          <p className="dictionary-note">{entry.note}</p>
        </section> :
        <section className="dictionary-result">
          <p className="dictionary-word">{word || "word"} <span>local draft</span></p>
          <p>This word is not in the local mini-dictionary yet. Later, this panel can call a server-side dictionary/AI endpoint for simple learner definitions, bilingual meanings, etymology, idioms, and examples.</p>
        </section>
      }
    </div>
  );
}

function DictionaryTab() {
  return (
    <main className="tab-page">
      <p className="overline">Built-In Tool</p>
      <h1 className="tab-title">Dictionary</h1>
      <p className="tab-lede">A future lesson-side dictionary for quick bilingual definitions when a student gets stuck on a word. This first version is a local prototype of the interface and output shape.</p>
      <DictionaryTool />
    </main>
  );
}

function BlogTab() {
  return (
    <main className="tab-page">
      <p className="overline">Teaching Notes</p>
      <h1 className="tab-title">Blog</h1>
      <p className="tab-lede">A future home for methodology posts, CEFR explanations, language-transfer notes, and lesson reflections. These starter cards define the first article lanes.</p>
      <div className="blog-grid">
        {BLOG_POSTS.map((post) =>
          <article className="blog-card" key={post.title}>
            <div className="post-meta">
              <span>{post.tag}</span>
              <span>{post.status}</span>
            </div>
            <h2>{post.title}</h2>
            <p>{post.summary}</p>
            <button type="button">Open draft</button>
          </article>
        )}
      </div>
    </main>
  );
}

function PlacementTab() {
  return (
    <main className="tab-page">
      <p className="overline">CEFR-Aligned Diagnostic</p>
      <h1 className="tab-title">Placement Exam</h1>
      <p className="tab-lede">A thorough student-facing diagnostic for estimating a learner's CEFR-aligned starting point from A0 to B2. It is not an official certificate exam. Recognition suggests a possible ceiling, while live listening, speaking, and writing help the teacher confirm the best path.</p>
      <section className="placement-hero">
        <div>
          <span className="placement-kicker">Main diagnostic</span>
          <h2>Find the level, then find the path.</h2>
          <p>The diagnostic combines auto-scored language tasks with teacher-marked listening, speaking, and writing evidence. The result gives a CEFR-aligned placement estimate, a level ladder, and a skill profile.</p>
          <a className="placement-cta" href="assessments/placement-exam.html">Open placement exam</a>
        </div>
        <div className="placement-stats">
          <span><b>A0-B2</b> CEFR range</span>
          <span><b>5</b> level bands</span>
          <span><b>6</b> skill areas</span>
          <span><b>Detailed</b> analysis</span>
        </div>
      </section>
      <div className="tab-grid">
        <section className="info-panel">
          <h2>What it measures</h2>
          <p>Grammar control, vocabulary range, reading, teacher-read listening, writing, speaking, fluency, interaction, and communication repair.</p>
        </section>
        <section className="info-panel">
          <h2>How it differs</h2>
          <p>Small quizzes prove progress inside a lesson or level. This exam estimates the student's current CEFR placement across the whole curriculum.</p>
        </section>
        <section className="info-panel">
          <h2>How to use it</h2>
          <p>Give it before a new student starts, then use the result to choose a level, plan lessons, and explain the student's starting profile clearly.</p>
        </section>
      </div>
    </main>
  );
}

function QuickCheckTab() {
  return (
    <main className="tab-page">
      <p className="overline">10-Minute Diagnostic</p>
      <h1 className="tab-title">Quick Level Check</h1>
      <p className="tab-lede">A short, student-facing check for a rough placement from Pre-A1 to B2. Ten questions become gradually more difficult, followed by a teacher-scored speaking sample.</p>
      <section className="placement-hero">
        <div>
          <span className="placement-kicker">Fast starting estimate</span>
          <h2>Find a useful starting point in ten minutes.</h2>
          <p>Use this when there is not enough time for the full diagnostic. The multiple-choice result is only an estimate, so the final two-minute speaking sample should confirm or adjust it.</p>
          <a className="placement-cta placement-cta--accent" href="assessments/quick-level-check.html">Open quick level check<span aria-hidden="true">→</span></a>
        </div>
        <div className="placement-stats">
          <span><b>10</b> questions</span>
          <span><b>8 min</b> language check</span>
          <span><b>2 min</b> speaking</span>
          <span><b>A0-B2</b> rough range</span>
        </div>
      </section>
      <div className="tab-grid">
        <section className="info-panel">
          <h2>What it does</h2>
          <p>Samples basic personal English, present and past forms, practical reading, and more complex B1-B2 structures.</p>
        </section>
        <section className="info-panel">
          <h2>What it does not do</h2>
          <p>It does not replace the full placement diagnostic and should not be presented as a formal CEFR result.</p>
        </section>
        <section className="info-panel">
          <h2>When to use it</h2>
          <p>Use it for a first conversation, a trial lesson, or a quick decision about which curriculum level to explore next.</p>
        </section>
      </div>
    </main>
  );
}

function FloatingDictionary() {
  const [open, setOpen] = useState(false);
  return (
    <div className={"floating-dict" + (open ? " is-open" : "")}>
      {open && <div className="floating-dict-panel">
        <div className="floating-dict-head">
          <b>Quick Dictionary</b>
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
        <DictionaryTool compact />
      </div>}
      <button className="floating-dict-button" onClick={() => setOpen(!open)}>
        Dictionary
      </button>
    </div>
  );
}

function AssessmentBand({ levelCode }) {
  const assessment = ASSESSMENTS[levelCode];
  if (!assessment) return null;
  return (
    <section className="assessment-band" aria-label={levelCode + " end-of-level diagnostic"}>
      {assessment.ready ?
      <a className="assessment-card assessment-card--exit" href={assessment.exitHref}>
        <span className="assessment-label">After completing the level</span>
        <h3>{assessment.exit}</h3>
        <p>{assessment.purpose}</p>
      </a> :
      <div className="assessment-card assessment-card--exit assessment-card--soon" aria-disabled="true">
        <span className="assessment-label">After completing the level</span>
        <h3>{assessment.exit}</h3>
        <p>{assessment.purpose}</p>
        <span className="assessment-soon">Coming soon</span>
      </div>
      }
      <div className="assessment-evidence">
        <span className="assessment-label">Ready to advance when the learner can</span>
        <ul>
          {assessment.evidence.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </section>
  );
}

// ============================ Toolbar ===================================
function Toolbar({ levels, theme, active, setActive, onPick, query, setQuery }) {
  return (
    <div className="toolbar">
      <div className="toolbar-inner">
        <nav className="pills" aria-label="Filter by level">
          <button className={"pill" + (active === "all" ? " is-active" : "")}
          onClick={() => setActive("all")}>All levels</button>
          {levels.map((l) =>
          <button key={l.code}
          className={"pill" + (active === l.code ? " is-active" : "")}
          style={accentVars(THEMES[theme][l.code], theme)}
          onClick={() => onPick(l.code)}>
              <span className="pill-dot" />{l.code}
            </button>
          )}
        </nav>
        <label className="search">
          <span className="search-ico" aria-hidden="true">⌕</span>
          <input type="text" placeholder="Search grammar, skills, topics…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button className="search-clear" onClick={() => setQuery("")}>✕</button>}
        </label>
      </div>
    </div>);

}

// ============================ Journey ===================================
function Journey({ levels, theme, onJump, active }) {
  return (
    <div className="journey">
      <div className="journey-track">
        {levels.map((l) => {
          const vars = accentVars(THEMES[theme][l.code], theme);
          return (
            <button key={l.code} className={"stop" + (active === l.code ? " is-active" : "")}
            style={vars} onClick={() => onJump(l.code)}>
              <span className="stop-rule" />
              <span className="stop-code">{l.code}</span>
              <span className="stop-name">{l.name}</span>
              <span className="stop-hours">{l.hours}</span>
            </button>);

        })}
      </div>
    </div>);

}

// ============================ Level section =============================
function LevelSection({ lvl, theme, query, refCb }) {
  const vars = accentVars(THEMES[theme][lvl.code], theme);

  const grammar = lvl.grammar.filter((t) => matches(t, query));
  const vocab = lvl.vocab.filter((t) => matches(t, query));
  const canDo = lvl.canDo.filter((t) => matches(t, query));
  const skillData = SKILLS.map((s) => ({
    ...s,
    items: lvl.skills[s.key].filter((t) => matches(t, query))
  }));

  const skillTotal = skillData.reduce((n, s) => n + s.items.length, 0);
  const empty = !grammar.length && !vocab.length && !canDo.length && !skillTotal && query;
  if (empty) return null;

  return (
    <section className="level" style={vars} ref={refCb} id={"lvl-" + lvl.code}>
      <div className="level-head">
        <div className="level-mark">
          <span className="level-code">{lvl.code}</span>
          <span className="level-name">{lvl.name}</span>
        </div>
        <div className="level-meta">
          <p className="level-cefr">{lvl.cefr}</p>
          <p className="level-blurb">{lvl.blurb}</p>
          <div className="level-chips">
            <span className="chip"><span className="chip-k">Guided study</span>{lvl.hours}</span>
            <span className="chip"><span className="chip-k">GSE range</span>{lvl.gse}</span>
          </div>
        </div>
      </div>

      {!!canDo.length &&
      <div className="cando">
          <h3 className="cando-title">By the end of <span className="code-inline">{lvl.code}</span>, a learner can…</h3>
          <ul className="cando-list">
            {canDo.map((t, i) =>
          <li key={i} className="cando-item">
                <span className="cando-bullet" /><Highlight text={t} query={query} />
              </li>
          )}
          </ul>
        </div>
      }

      <div className="grid">
        {!!grammar.length &&
        <Card label="Grammar" index="Aa" wide>
            <ul className="list list--two">
              {grammar.map((g) =>
            <LessonItem key={g} href={lessonHref(lvl.code, g)} text={g} query={query}
            ready={lessonReady(lvl.code, g)} />
            )}
            </ul>
          </Card>
        }
        {!!vocab.length &&
        <Card label="Vocabulary & Topics" index="¶" wide>
            <div className="chips-wrap">
              {vocab.map((v) =>
            lessonReady(lvl.code, v) ?
            <a key={v} className="vchip" href={lessonHref(lvl.code, v)}>
                  <Highlight text={v} query={query} />
                  <span className="vchip-go" aria-hidden="true">→</span>
                </a> :
            <span key={v} className="vchip vchip--soon" aria-disabled="true" title="Lesson coming soon">
                  <Highlight text={v} query={query} />
                  <span className="soon-tag">Soon</span>
                </span>
            )}
            </div>
          </Card>
        }
        {skillData.map((s, si) =>
        s.items.length ?
        <Card key={s.key} label={s.label} index={String(si + 1).padStart(2, "0")}>
              <ul className="list list--plain">
                {s.items.map((t, i) =>
            <li key={i} className="item item--static">
                    <span className="item-tick" aria-hidden="true" />
                    <span className="item-text"><Highlight text={t} query={query} /></span>
                  </li>
            )}
              </ul>
            </Card> :
        null
        )}
      </div>

      <AssessmentBand levelCode={lvl.code} />
    </section>);

}

// ============================ App =======================================
function App({ tweaks }) {
  const theme = tweaks && tweaks.theme || "spectrum";
  const density = tweaks && tweaks.density || "comfortable";
  const display = tweaks && tweaks.display || "serif";

  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const [siteTab, setSiteTab] = useState("curriculum");
  const sectionRefs = useRef({});
  const pendingJump = useRef(null);

  // Scroll a level section to just below the sticky toolbar. The toolbar height
  // varies when its pills/search wrap, so measure it live; use the section's
  // document-relative top (getBoundingClientRect + scrollY) for accuracy.
  const scrollToLevel = (code) => {
    const el = sectionRefs.current[code];
    if (!el) return;
    const toolbar = document.querySelector(".toolbar");
    const offset = (toolbar ? toolbar.offsetHeight : 0) + 16;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const jump = (code) => {
    // If a level filter is active, the other sections aren't mounted yet. Clear
    // the filter first and defer the scroll until they render (see useEffect).
    if (active !== "all") {
      pendingJump.current = code;
      setActive("all");
    } else {
      requestAnimationFrame(() => scrollToLevel(code));
    }
  };

  // Filter pills: filter to a level and scroll to it. Clicking the level that
  // is already active clears the filter (back to all levels) without scrolling.
  const selectLevel = (code) => {
    if (active === code) {
      setActive("all");
      return;
    }
    pendingJump.current = code;
    setActive(code);
  };

  // Run a deferred jump/scroll once the target section has (re)rendered.
  useEffect(() => {
    if (pendingJump.current) {
      const code = pendingJump.current;
      pendingJump.current = null;
      requestAnimationFrame(() => scrollToLevel(code));
    }
  }, [active]);

  const visible = CURRICULUM.filter((l) => active === "all" || active === l.code);

  return (
    <div className="page" data-theme={theme} data-density={density} data-display={display}>
      <Header />
      <SiteTabs active={siteTab} setActive={setSiteTab} />
      {siteTab === "curriculum" && <>
        <Toolbar levels={CURRICULUM} theme={theme} active={active} setActive={setActive}
        onPick={selectLevel} query={query} setQuery={setQuery} />
        <CefrExplainer />
        <Journey levels={CURRICULUM} theme={theme}
        onJump={jump} active={active === "all" ? null : active} />

        <main className="sections">
          {visible.map((l) =>
          <LevelSection key={l.code} lvl={l} theme={theme} query={query}
          refCb={(el) => sectionRefs.current[l.code] = el} />
          )}
          {query && !visible.some((l) => levelHasMatches(l, query)) &&
          <div className="noresult">
              <p>No matches for “<b>{query}</b>”.</p>
              <button className="noresult-clear" onClick={() => setQuery("")}>Clear search</button>
            </div>
          }
        </main>
      </>}
      {siteTab === "placement" && <PlacementTab />}
      {siteTab === "quick-check" && <QuickCheckTab />}
      {siteTab === "bio" && <BioTab />}
      {siteTab === "languages" && <LanguagesTab />}
      {siteTab === "blog" && <BlogTab />}
      {siteTab === "dictionary" && <DictionaryTab />}

      <FloatingDictionary />
      <footer className="foot">
        <p>Aligned to the Common European Framework of Reference for Languages (CEFR).
        Hour estimates and GSE ranges are indicative guides, not guarantees.</p>
        <p className="foot-mark">Curriculum Map · A0 → B2</p>
      </footer>
    </div>);

}

window.CurriculumApp = App;
