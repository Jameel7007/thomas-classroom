import type { CurriculumLevel } from "../lib/curriculum";

export const curriculum = [
  {
    "code": "A0",
    "name": "Starter",
    "cefr": "Pre-A1 · Absolute Beginner",
    "hours": "0–60 hrs",
    "gse": "10–21",
    "blurb": "The very first contact with English. Learners build the alphabet, sounds, numbers and a handful of survival phrases — enough to say who they are and exchange a few words.",
    "canDo": [
      "Recognise and say the alphabet and numbers 0–100.",
      "Give basic personal details: name, age, nationality.",
      "Understand and use a small set of everyday greetings.",
      "Fill in a simple form with name, address and date of birth."
    ],
    "skills": {
      "listening": [
        "Recognise familiar words about myself and my family when spoken slowly.",
        "Understand numbers, prices and times said clearly."
      ],
      "reading": [
        "Understand single words and very short, simple signs.",
        "Read a name, a date and a price on a form or label."
      ],
      "speaking": [
        "Introduce myself and use basic greetings and farewells.",
        "Ask and answer simple questions about personal details."
      ],
      "writing": [
        "Write my name, nationality and address on a form.",
        "Write simple isolated words and very short phrases."
      ]
    }
  },
  {
    "code": "A1",
    "name": "Breakthrough",
    "cefr": "A1 · Beginner",
    "hours": "60–100 hrs",
    "gse": "22–29",
    "blurb": "Learners can handle the basics of daily life. They talk about routines, possessions and immediate needs using simple present-tense structures, if the other person speaks slowly and clearly.",
    "canDo": [
      "Understand and use familiar everyday expressions and basic phrases.",
      "Introduce myself and others and ask about personal details.",
      "Interact in a simple way provided the other person talks slowly.",
      "Describe my home, routine and possessions in simple terms."
    ],
    "skills": {
      "listening": [
        "Follow speech that is very slow and carefully articulated.",
        "Understand simple directions and instructions."
      ],
      "reading": [
        "Understand short, simple texts a single phrase at a time.",
        "Get the gist of simple notices, menus and timetables."
      ],
      "speaking": [
        "Ask and answer questions about everyday routines.",
        "Make simple transactions in shops, cafés and stations."
      ],
      "writing": [
        "Write short, simple notes and messages.",
        "Write a simple postcard or fill in a detailed form."
      ]
    }
  },
  {
    "code": "A2",
    "name": "Waystage",
    "cefr": "A2 · Elementary",
    "hours": "100–200 hrs",
    "gse": "30–42",
    "blurb": "Learners cope with routine tasks and exchanges. They can talk about the past and the future, compare things, and describe their background and immediate environment in short connected sentences.",
    "canDo": [
      "Understand sentences and frequent expressions of immediate relevance.",
      "Communicate in simple, routine tasks needing direct exchange of information.",
      "Describe my background, environment and immediate needs.",
      "Tell a simple story about past events and experiences."
    ],
    "skills": {
      "listening": [
        "Understand phrases about areas of immediate personal relevance.",
        "Catch the main point in short, clear messages and announcements."
      ],
      "reading": [
        "Read short, simple texts and find specific information.",
        "Understand everyday signs, ads and short personal letters."
      ],
      "speaking": [
        "Handle short social exchanges without sustaining the conversation myself.",
        "Describe my family, living conditions and educational background."
      ],
      "writing": [
        "Write short, simple notes and a basic personal letter.",
        "Connect sentences with simple linkers like and, but and because."
      ]
    }
  },
  {
    "code": "B1",
    "name": "Threshold",
    "cefr": "B1 · Intermediate",
    "hours": "200–350 hrs",
    "gse": "43–58",
    "blurb": "The independent-user threshold. Learners deal with most situations while travelling, produce connected text on familiar topics, and explain their opinions, plans and experiences.",
    "canDo": [
      "Understand the main points of clear standard input on familiar matters.",
      "Deal with most situations likely to arise while travelling.",
      "Produce simple connected text on topics of personal interest.",
      "Describe experiences, events, dreams, hopes and ambitions."
    ],
    "skills": {
      "listening": [
        "Follow the main points of clear standard speech on familiar matters.",
        "Understand the information in many radio or TV programmes."
      ],
      "reading": [
        "Understand texts with everyday or job-related language.",
        "Grasp the description of events, feelings and wishes in letters."
      ],
      "speaking": [
        "Enter unprepared into conversation on familiar topics.",
        "Narrate a story and describe reactions, hopes and ambitions."
      ],
      "writing": [
        "Write straightforward connected text on familiar subjects.",
        "Write personal letters describing experiences and impressions."
      ]
    }
  },
  {
    "code": "B2",
    "name": "Vantage",
    "cefr": "B2 · Upper-Intermediate",
    "hours": "350–600 hrs",
    "gse": "59–75",
    "blurb": "Learners interact with fluency and spontaneity. They understand complex and abstract texts, argue a point of view, and write clear, detailed prose across a wide range of subjects.",
    "canDo": [
      "Understand the main ideas of complex text on concrete and abstract topics.",
      "Interact with a degree of fluency and spontaneity with native speakers.",
      "Produce clear, detailed text on a wide range of subjects.",
      "Explain a viewpoint, giving the advantages and disadvantages."
    ],
    "skills": {
      "listening": [
        "Understand extended speech and follow complex lines of argument.",
        "Understand most TV news, documentaries and films in standard speech."
      ],
      "reading": [
        "Read articles and reports on contemporary problems and viewpoints.",
        "Understand contemporary literary prose at a comfortable pace."
      ],
      "speaking": [
        "Interact fluently enough to make regular conversation feel effortless.",
        "Present clear, detailed arguments and develop a point of view."
      ],
      "writing": [
        "Write clear, detailed text on a range of subjects in my field.",
        "Write essays or reports, evaluating ideas and weighing evidence."
      ]
    }
  }
] satisfies CurriculumLevel[];
