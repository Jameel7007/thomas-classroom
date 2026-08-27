import { siteSettings } from "../data/site-settings.mjs";

export function schemaIds(site) {
  const home = new URL("/", site).href;
  return Object.freeze({
    home,
    tutor: `${home}#tutor`,
    website: `${home}#website`,
  });
}

export function siteIdentityNodes(site) {
  const ids = schemaIds(site);
  return [
    {
      "@type": "Person",
      "@id": ids.tutor,
      name: "Thomas",
      url: ids.home,
      sameAs: [siteSettings.bookingUrl],
      jobTitle: "American English tutor",
      knowsAbout: [
        "American English",
        "English grammar",
        "English pronunciation",
        "Adult English education",
        "CEFR-aligned English instruction",
      ],
    },
    {
      "@type": "WebSite",
      "@id": ids.website,
      name: "Thomas’s Classroom",
      url: ids.home,
      inLanguage: "en",
      publisher: { "@id": ids.tutor },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${ids.home}curriculum/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function webPageNode({ canonical, title, description, site, type = "WebPage", mainEntityId }) {
  const ids = schemaIds(site);
  const node = {
    "@type": type,
    "@id": `${canonical.href}#webpage`,
    url: canonical.href,
    name: title,
    description,
    inLanguage: "en",
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.tutor },
  };
  if (mainEntityId) node.mainEntity = { "@id": mainEntityId };
  return node;
}

export function assessmentSchemaNodes({ page, canonical, site, documentTitle = page.title }) {
  const ids = schemaIds(site);
  const assessmentId = `${canonical.href}#assessment`;
  const levelMatch = page.slug.match(/^([a-b][0-2])-exit$/i);
  const educationalLevel = levelMatch ? levelMatch[1].toUpperCase() : "A0–B2";
  const questionCount = page.interactionCounts?.["data-assessment-item"]
    ?? (page.slug === "quick-level-check" ? 10 : undefined);
  const quiz = {
    "@type": "Quiz",
    "@id": assessmentId,
    url: canonical.href,
    name: page.title,
    description: page.description,
    inLanguage: "en",
    educationalLevel,
    learningResourceType: page.slug === "placement-exam" ? "Placement diagnostic" : "English assessment",
    educationalUse: ["assessment", "diagnosis"],
    interactivityType: "mixed",
    isAccessibleForFree: true,
    assesses: page.slug === "placement-exam"
      ? "English proficiency and recommended CEFR starting level from A0 to B2"
      : `${educationalLevel} English language ability`,
    author: { "@id": ids.tutor },
    isPartOf: { "@id": ids.website },
  };
  if (questionCount) quiz.numberOfQuestions = questionCount;
  return [
    ...siteIdentityNodes(site),
    webPageNode({ canonical, title: documentTitle, description: page.description, site, mainEntityId: assessmentId }),
    quiz,
  ];
}
