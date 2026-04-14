
  /** Build plausible distractor options around a correct answer. */
  function makeOptions(correct: string, otherConcepts: string[]): string[] {
    const distractors = otherConcepts
      .filter((c) => c.toLowerCase() !== correct.toLowerCase())
      .map((concept) => {
        const templates = [
          `It primarily serves as a ${concept} mechanism for the system`,
          `It focuses on optimizing how ${concept} interacts with other components`,
          `It is designed to replace ${concept} with a more efficient alternative`,
          `Its main role is to coordinate ${concept} across different system layers`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      })
      .slice(0, 3);

    const genericDistractors = [
      `It has no measurable impact on the system and is purely decorative`,
      `It only functions in isolation without connecting to other components`,
      `It is an optional feature that can be safely removed without consequences`,
    ];
    while (distractors.length < 3) {
      distractors.push(genericDistractors[distractors.length]);
    }

    const options = [...distractors, correct];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options.slice(0, 4);
  }

  function generateSimpleQuizQuestions(content: string, title: string, itemCount = MIN_ITEMS): QuizQuestion[] {
    const safeCount = clampItemCount(itemCount);
    const questions: QuizQuestion[] = [];
    const concepts = extractConcepts(content);

    // ─── Question Type 1: Core Understanding ───
    const addCoreUnderstanding = () => {
      const main = concepts.length > 0 ? concepts[Math.floor(Math.random() * Math.min(concepts.length, 3))] : title;
      const correctAnswer = `${main} provides a structured way to manage and optimize how the system handles related tasks, establishing clear patterns for how components interact.`;
      questions.push({
        question: `What is the primary purpose of ${main} within the broader system?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 Understanding the role of ${main} means you can explain not just what it does, but why the system needs it and how it connects to other parts.`,
        type: 'core' as const,
      });
    };

    // ─── Question Type 2: Process / Mechanism ───
    const addMechanism = () => {
      const main = concepts.length > 0 ? concepts[Math.floor(Math.random() * concepts.length)] : title;
      const correctAnswer = `${main} first identifies the relevant context, then applies the appropriate rules or patterns, and finally integrates the result back into the broader system.`;
      questions.push({
        question: `When ${main} is applied or activated, what happens at the system level step-by-step?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 ${main} establishes a defined mechanism that guides how the system handles related inputs — understanding the sequence is key.`,
        type: 'process' as const,
      });
    };

    // ─── Question Type 3: Application / Real-World ───
    const addApplication = () => {
      const main = concepts.length > 0 ? concepts[Math.floor(Math.random() * Math.min(concepts.length, 4))] : title;
      const correctAnswer = `They should map out the current workflow and identify exactly where ${main} would integrate and add value, ensuring it solves real problems rather than creating new ones.`;
      questions.push({
        question: `An organization wants to improve their outcomes using ${main}. What should be their first step and why?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 Understanding the current state before introducing ${main} ensures it solves real problems rather than creating new ones.`,
        type: 'application' as const,
      });
    };

    // ─── Question Type 4: Confusion Test ───
    const addConfusion = () => {
      const a = concepts[0] || title;
      const b = concepts.length > 1 ? concepts[1] : 'a related alternative approach';
      const correctAnswer = `${a} focuses on the mechanism of delivery while ${b} focuses on the structure and organization of what is delivered — they address different layers of the system.`;
      questions.push({
        question: `What is the fundamental difference between ${a} and ${b} in how they operate?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 They are often confused because they work together, but their core functions address different layers of the system.`,
        type: 'confusion' as const,
      });
    };

    // ─── Question Type 5: Edge Case / Deep Thinking ───
    const addEdgeCase = () => {
      const main = concepts.length > 0 ? concepts[Math.floor(Math.random() * concepts.length)] : title;
      const correctAnswer = `It would partially function but miss critical context, leading to incomplete or misleading results — ${main} was optimized for a specific context and using it outside that scope introduces blind spots.`;
      questions.push({
        question: `What if ${main} were applied in a context it was NOT originally designed for — what is the most likely outcome?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 ${main} was optimized for a specific context — using it outside that scope introduces blind spots in how it processes information.`,
        type: 'edge' as const,
      });
    };

    // ─── Question Type 6: What If / Reasoning ───
    const addWhatIf = () => {
      const main = concepts.length > 1 ? concepts[Math.floor(Math.random() * Math.min(concepts.length, 5))] : title;
      const correctAnswer = `The system loses a key capability and downstream processes may fail or produce incomplete results because ${main} was designed as an integral part, not an optional add-on.`;
      questions.push({
        question: `What happens to the overall system if ${main} is removed or significantly altered?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 Removing ${main} breaks a dependency chain — the system was designed with ${main} as an integral part, not an optional add-on.`,
        type: 'edge' as const,
      });
    };

    // ─── Question Type 7: Scenario-Based ───
    const addScenario = () => {
      const main = concepts.length > 1 ? concepts[Math.floor(Math.random() * Math.min(concepts.length, 4))] : title;
      const correctAnswer = `The most likely challenge is understanding how ${main} connects to the overall system architecture — the best approach is to first study the system-level role of ${main} before making changes.`;
      questions.push({
        question: `A team is implementing ${main} in their workflow. What is the most likely challenge they would face during adoption?`,
        options: makeOptions(correctAnswer, concepts),
        correct: 0,
        answer: correctAnswer,
        explanation: `👉 Understanding the system-level role of ${main} is foundational — without it, implementation decisions become guesswork.`,
        type: 'application' as const,
      });
    };

    // Build questions in order — each type tests a different kind of thinking
    const generators = [
      addCoreUnderstanding,  // Core understanding (1)
      addCoreUnderstanding,  // Core understanding (2)
      addMechanism,          // Process / Mechanism (1)
      addMechanism,          // Process / Mechanism (2)
      addApplication,        // Application (1)
      addApplication,        // Application (2)
      addConfusion,          // Confusion test (1)
      addEdgeCase,           // Edge case / Deep thinking (1)
      addWhatIf,             // What if / Reasoning
      addScenario,           // Scenario-based
    ];

    for (let i = 0; i < Math.min(safeCount, generators.length); i++) {
      generators[i]();
    }

    // If we need more questions, fill with core understanding
    while (questions.length < safeCount) {
      addCoreUnderstanding();
    }

    // Fix the correct index for each question — find where the correct answer landed after shuffling
    for (const q of questions) {
      if (q.options && q.answer) {
        const correctIdx = q.options.findIndex(
          (opt) => opt.toLowerCase().trim() === q.answer!.toLowerCase().trim()
        );
        q.correct = correctIdx >= 0 ? correctIdx : 0;
      }
    }

    return questions.slice(0, safeCount);
  }
