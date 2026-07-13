import path from "node:path";

export interface LegacyPage {
  sourcePath: string;
  source: string;
  slug: string;
  level?: string;
}

const lessonModules = import.meta.glob(
  "../../../outputs/lessons/*/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const assessmentModules = import.meta.glob(
  "../../../outputs/assessments/*.html",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const lessonPages: LegacyPage[] = Object.entries(lessonModules)
  .flatMap(([modulePath, source]) => {
    const match = modulePath.match(/outputs\/lessons\/(a0|a1|a2|b1|b2)\/([^/]+)\.html$/i);
    if (!match) return [];
    return [{
      source,
      sourcePath: `lessons/${match[1].toLowerCase()}/${match[2]}.html`,
      level: match[1].toUpperCase(),
      slug: match[2],
    }];
  });

export const legacyLessons = lessonPages
  .filter((page) => !/<meta\s+http-equiv="refresh"/i.test(page.source));

export const legacyAssessments: LegacyPage[] = Object.entries(assessmentModules)
  .flatMap(([modulePath, source]) => {
    const match = modulePath.match(/outputs\/assessments\/([^/]+)\.html$/i);
    if (!match) return [];
    return [{
      source,
      sourcePath: `assessments/${match[1]}.html`,
      slug: match[1],
    }];
  });

export interface MigratedDocument {
  head: string;
  body: string;
  bodyClass?: string;
  lang: string;
}

export function migrateLegacyDocument(source: string, sourcePath: string, canonical: URL): MigratedDocument {
  const rewritten = source.replace(/\b(href|src)="([^"]+)"/gi, (_match, attribute, reference) => {
    return `${attribute}="${rewriteReference(reference, sourcePath)}"`;
  });
  const headMatch = rewritten.match(/<head>([\s\S]*?)<\/head>/i);
  const bodyMatch = rewritten.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const htmlMatch = rewritten.match(/<html([^>]*)>/i);
  if (!headMatch || !bodyMatch) throw new Error(`Cannot migrate ${sourcePath}: missing head or body.`);

  let head = headMatch[1];
  if (!/<meta\b[^>]*name="description"/i.test(head)) {
    const description = extractDescription(bodyMatch[2]);
    if (description) head += `\n<meta name="description" content="${escapeAttribute(description)}">`;
  }
  head += `\n<link rel="canonical" href="${canonical.href}">`;

  return {
    head,
    body: bodyMatch[2],
    bodyClass: bodyMatch[1].match(/\bclass="([^"]+)"/i)?.[1],
    lang: htmlMatch?.[1].match(/\blang="([^"]+)"/i)?.[1] || "en",
  };
}

function rewriteReference(reference: string, sourcePath: string) {
  if (!reference || /^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(reference)) return reference;
  const hashIndex = reference.indexOf("#");
  const queryIndex = reference.indexOf("?");
  const cutAt = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? reference.length;
  const pathname = decodeURIComponent(reference.slice(0, cutAt));
  const suffix = reference.slice(cutAt);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), pathname));

  if (/^English Curriculum Map\.html$/i.test(resolved)) return `/curriculum/${suffix}`;
  if (/^index\.html$/i.test(resolved)) return `/${suffix}`;

  const lesson = resolved.match(/^lessons\/(a0|a1|a2|b1|b2)\/([^/]+)\.html$/i);
  if (lesson) {
    const slug = lesson[2] === "some-any-with-countable-uncountable-nouns"
      ? "some-any-with-countable-and-uncountable-nouns"
      : lesson[2];
    return `/lessons/${lesson[1].toLowerCase()}/${slug}/${suffix}`;
  }

  const assessment = resolved.match(/^assessments\/([^/]+)\.html$/i);
  if (assessment) return `/assessments/${assessment[1]}/${suffix}`;

  if (/\.(?:css|js|svg|png|jpe?g|webp|gif|mp3|json)$/i.test(resolved)) {
    return `/legacy-assets/${resolved}${suffix}`;
  }
  return reference;
}

function extractDescription(body: string) {
  const candidate = body.match(/<(?:p)[^>]*class="(?:standfirst|lede)"[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  if (!candidate) return "";
  return candidate
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 175);
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
