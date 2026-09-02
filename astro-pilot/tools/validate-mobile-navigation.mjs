import { readFile } from 'node:fs/promises';
import { setupMobileNavigation } from '../src/scripts/mobile-navigation.js';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }
}

const toggle = new FakeTarget();
toggle.focusCalls = [];
toggle.focus = (options) => toggle.focusCalls.push(options);
const links = Array.from({ length: 5 }, () => new FakeTarget());
const details = new FakeTarget();
details.open = false;
details.querySelectorAll = (selector) => selector === 'a' ? links : [];
const media = new FakeTarget();
media.matches = false;
const root = new FakeTarget();
root.querySelector = (selector) => selector === '[data-mobile-nav]' ? details : selector === '[data-mobile-nav-toggle]' ? toggle : null;
const view = { matchMedia: (query) => {
  if (query !== '(min-width: 981px)') throw new Error(`Unexpected media query: ${query}`);
  return media;
} };
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(setupMobileNavigation(root, view), 'menu controller did not initialize');
expect(toggle.getAttribute('aria-expanded') === 'false', 'initial expanded state is not false');
expect(toggle.getAttribute('aria-label') === 'Open navigation menu', 'initial accessible label is incorrect');

details.open = true;
details.dispatch('toggle');
expect(toggle.getAttribute('aria-expanded') === 'true', 'open menu did not expose expanded state');
expect(toggle.getAttribute('aria-label') === 'Close navigation menu', 'open menu label is incorrect');

let escapePrevented = false;
root.dispatch('keydown', { key: 'Escape', preventDefault: () => { escapePrevented = true; } });
expect(!details.open && escapePrevented, 'Escape did not close the menu and prevent its default action');
expect(toggle.focusCalls.length === 1 && toggle.focusCalls[0].preventScroll, 'Escape did not return focus without scrolling');

details.open = true;
details.dispatch('toggle');
links[2].dispatch('click');
expect(!details.open, 'selecting a link did not close the menu');
expect(toggle.focusCalls.length === 2, 'selecting a link did not return focus to the menu control');

details.open = true;
details.dispatch('toggle');
media.matches = true;
media.dispatch('change', media);
expect(!details.open, 'crossing to the desktop breakpoint did not close the mobile menu');
expect(toggle.focusCalls.length === 2, 'breakpoint cleanup moved focus unexpectedly');

const [css, pageSource, homeScript] = await Promise.all([
  readFile(new URL('../src/styles/home.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/scripts/home.js', import.meta.url), 'utf8'),
]);
expect(/@media\(max-width:980px\)/.test(css), '980px mobile breakpoint is missing');
expect(/@media\(max-width:430px\)/.test(css), 'narrow wordmark protection is missing');
expect(/prefers-reduced-motion:reduce/.test(css), 'reduced-motion handling is missing');
expect(/\.menu-toggle:focus-visible/.test(css), 'visible menu focus styling is missing');
expect(/<span>Thomas's Classroom<\/span>/.test(pageSource),
  'homepage header must render the complete Thomas\'s Classroom wordmark');
expect(!/logo-(?:full|short)/.test(pageSource + css),
  'homepage header must not swap the complete wordmark for a shortened mobile version');
expect(/and it\{' '\}\s*<span class="err">change<\/span>/.test(pageSource),
  'Present Perfect noticing sentence must keep an explicit source whitespace node between “it” and “change”');
expect(/document\.body\.dataset\.publicReviewCount/.test(homeScript),
  'homepage review toast must derive its count from canonical rendered settings');
for (const [name, source] of [['homepage markup', pageSource], ['homepage styles', css], ['homepage script', homeScript]]) {
  expect(!/(?:data-theme|themeBtn|theme-wipe|blackout|localStorage)/.test(source), `${name} still contains obsolete theme-toggle code`);
}

for (const width of [320, 375, 768, 979, 980]) expect(width <= 980, `${width}px is not covered by the mobile breakpoint`);
for (const width of [981, 1024, 1440]) expect(width > 980, `${width}px is not covered by the desktop layout`);

if (errors.length) {
  console.error(`Mobile navigation validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Mobile navigation verified: state, Escape, link close, focus return, desktop cleanup, no theme-control spacing, reduced motion, and 320/375/768/979/980/981/1024/1440px breakpoint coverage.');
