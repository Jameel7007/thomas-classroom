export const quickCheckQuestions = Object.freeze([
  {
    band: "a1",
    passage: "Maya: Hi, I'm Maya. ____? Leo: I'm Leo.",
    prompt: "Choose the natural question.",
    choices: ["What your name is?", "What's your name?", "How you are called?"],
    answer: 1,
    why: "Use What is your name? to ask directly for a person's name.",
  },
  {
    band: "a1",
    passage: "Nora works at a clinic. Her shift starts at eight every weekday.",
    prompt: "Which sentence describes Nora's routine?",
    choices: ["She start work at eight.", "She is start work at eight.", "She starts work at eight."],
    answer: 2,
    why: "Use the present simple and add -s to the verb after she for a regular routine.",
  },
  {
    band: "a2",
    prompt: "Yesterday, the train was late, so I ____ a taxi to work.",
    choices: ["take", "took", "am taking"],
    answer: 1,
    why: "Yesterday places the completed action in the past, so take changes to took.",
  },
  {
    band: "a2",
    passage: "I usually work at home, but this week the office team needs me there.",
    prompt: "Complete the sentence: This week, I ____ at the office.",
    choices: ["am working", "work", "worked"],
    answer: 0,
    why: "This week describes a temporary situation around now, so use am working.",
  },
  {
    band: "b1",
    passage: "Priya: I sent the revised report. I left the final chart unchanged because the client approved it yesterday. Let me know if anything else needs attention.",
    prompt: "Why did Priya leave the chart unchanged?",
    choices: ["She did not have time to revise it.", "She planned to remove it later.", "The client had already approved it."],
    answer: 2,
    why: "The message explicitly connects the unchanged chart to the client's earlier approval.",
  },
  {
    band: "b1",
    prompt: "I've worked with this client ____ three years, and we still meet every month.",
    choices: ["for", "since", "during"],
    answer: 0,
    why: "Use for with a length of time: for three years.",
  },
  {
    band: "b1",
    passage: "Your coworker suggests removing the final quality check to save time.",
    prompt: "Which response disagrees politely and gives a reason?",
    choices: ["No. That idea is bad.", "I see your point, but removing the check could create more errors.", "I agree because the check takes time."],
    answer: 1,
    why: "The response acknowledges the other view, disagrees clearly, and supports the disagreement with a reason.",
  },
  {
    band: "b2",
    passage: "The committee needs more reliable cost data before it can make a final decision.",
    prompt: "Complete the formal update: The committee has decided to ____ the proposal until the new figures are available.",
    choices: ["put later", "delay about", "defer"],
    answer: 2,
    why: "Defer is the precise formal verb for postponing a decision until a later time.",
  },
  {
    band: "b2",
    prompt: "Which sentence presents a cautious conclusion in a formal report?",
    choices: ["The decline may partly reflect seasonal changes.", "The decline definitely proves that the policy failed.", "Maybe the decline is because stuff changes in winter."],
    answer: 0,
    why: "May partly reflect expresses appropriate caution while keeping a formal register.",
  },
  {
    band: "b2",
    passage: "Remote work can reduce commuting time, but some managers worry about collaboration. A hybrid policy may address both concerns if teams agree on shared office days.",
    prompt: "Which response engages most directly with both sides of the argument?",
    choices: ["Remote work is better because commuting is stressful.", "Although collaboration can be harder remotely, shared office days could preserve teamwork while reducing commuting.", "Managers worry about collaboration, and commuting takes time."],
    answer: 1,
    why: "The response concedes the collaboration concern and then proposes a solution that preserves the main benefit.",
  },
].map((question) => Object.freeze({ ...question, choices: Object.freeze([...question.choices]) })));

export const quickCheckResults = Object.freeze({
  a0: Object.freeze({
    level: "A0 / Pre-A1",
    explanation: "The evidence suggests beginning with the A0 foundations. Confirm familiar personal words and short supported answers before choosing the first lesson.",
  }),
  a1: Object.freeze({
    level: "A1",
    explanation: "The evidence suggests an A1 starting point. Confirm that the learner can give simple personal information and build short present-tense sentences aloud.",
  }),
  a2: Object.freeze({
    level: "A2",
    explanation: "The evidence suggests an A2 starting point. Confirm a short connected account of everyday routines, past events, and near-future plans.",
  }),
  b1: Object.freeze({
    level: "B1",
    explanation: "The evidence suggests a B1 starting point. Confirm that the learner can sustain an explanation, give reasons, and respond to follow-up questions.",
  }),
  b2: Object.freeze({
    level: "B2 checkpoint",
    explanation: "The language-use evidence reached the B2 checkpoint. Confirm an extended, supported viewpoint or use the full placement diagnostic before choosing a B2 starting point.",
  }),
});

export const quickCheckSpeakingTasks = Object.freeze([
  Object.freeze({
    id: "a0",
    label: "A0 / Pre-A1 prompt",
    prompt: "Tell me your name, where you are from, and whether you work or study. Short answers are fine.",
    followUps: Object.freeze(["Where do you live?", "What languages do you speak?"]),
  }),
  Object.freeze({
    id: "a1",
    label: "A1 prompt",
    prompt: "Tell me about your normal weekday. Say what you do in the morning, afternoon, and evening.",
    followUps: Object.freeze(["What time do you start your day?", "What do you usually do after work or class?"]),
  }),
  Object.freeze({
    id: "a2",
    label: "A2 prompt",
    prompt: "Tell me what you did last weekend, then explain one plan for next weekend.",
    followUps: Object.freeze(["What happened first?", "Why did you choose that plan?"]),
  }),
  Object.freeze({
    id: "b1",
    label: "B1 prompt",
    prompt: "Describe a problem you solved at work, in a class, or at home. Explain the situation, your action, the result, and what you would do differently now.",
    followUps: Object.freeze(["Why did you choose that solution?", "What other option did you consider?"]),
  }),
  Object.freeze({
    id: "b2",
    label: "B2 checkpoint prompt",
    prompt: "Would a four-day workweek be effective for most workplaces? Give a clear position, one advantage, one disadvantage, and a conclusion.",
    followUps: Object.freeze(["How would you respond to the claim that productivity would fall?", "What conditions would make the policy succeed?"]),
  }),
]);

export const quickCheckData = Object.freeze({
  questions: quickCheckQuestions,
  results: quickCheckResults,
});
