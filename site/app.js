const CHAPTERS = [
  { number: 1, fallback: "안전위생관리" },
  { number: 2, fallback: "챕터 2" },
  { number: 3, fallback: "챕터 3" },
  { number: 4, fallback: "챕터 4" },
  { number: 5, fallback: "챕터 5" },
  { number: 6, fallback: "챕터 6" }
];
const STORAGE_KEY = "dogexam-cpt-progress-v1";
const EXAM_HISTORY_KEY = "dogexam-cpt-exam-history-v1";
const DATA_VERSION = "2026-11-06-2";
const state = {
  chapters: new Map(),
  answers: readProgress(),
  examHistory: readExamHistory(),
  activeChapter: 1,
  activeIndex: 0,
  mode: "practice",
  attempt: null
};

function readProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers)); }
  catch { /* Private browsing or a disabled storage area may block persistence. */ }
}
function readExamHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history.filter(function (record) { return record && Number.isFinite(record.total) && record.total > 0; }) : [];
  } catch { return []; }
}
function saveExamHistory(record) {
  state.examHistory.push(record);
  try { localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(state.examHistory)); }
  catch { /* Keep this session's dashboard usable if browser storage is unavailable. */ }
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}
function chapterData(number) { return state.chapters.get(number) || null; }
function chapterAnswers(number) {
  const data = chapterData(number);
  return data && data.answerData && data.answerData.answers ? data.answerData.answers : {};
}
function isReady(question) { return question && question.status !== "incomplete" && Array.isArray(question.choices) && question.choices.length >= 2; }
function isGradeableKey(question, key) {
  if (!isReady(question) || key === undefined || key === null) return false;
  const labels = new Set(question.choices.map(function (choice) { return choice.label; }));
  const expected = Array.isArray(key) ? key : [key];
  return expected.length > 0 && expected.every(function (label) { return typeof label === "string" && labels.has(label); });
}
function selectionIndexes(question, saved) {
  if (!question || !Array.isArray(question.choices) || saved === undefined || saved === null) return [];
  let selection = saved;
  if (selection && typeof selection === "object" && !Array.isArray(selection)) selection = selection.selected;
  if (Array.isArray(selection)) {
    if (selection.every(Number.isInteger)) return selection.filter(function (index) { return index >= 0 && index < question.choices.length; });
    return selection.map(function (label) { return question.choices.findIndex(function (choice) { return choice.label === label; }); }).filter(function (index) { return index >= 0; });
  }
  if (typeof selection === "string") {
    const index = question.choices.findIndex(function (choice) { return choice.label === selection; });
    return index < 0 ? [] : [index];
  }
  return [];
}
function hasSelection(question, saved) { return selectionIndexes(question, saved).length > 0; }
function answerConfirmed(saved) { return Boolean(saved && typeof saved === "object" && !Array.isArray(saved) && saved.checked); }
function isAnswered(question, saved, key) {
  return Array.isArray(key) ? answerConfirmed(saved) : saved !== undefined;
}
function responseIsCorrect(question, response, key) {
  if (!isGradeableKey(question, key)) return false;
  const selectedLabels = selectionIndexes(question, response).map(function (index) { return question.choices[index].label; }).sort();
  const correctLabels = (Array.isArray(key) ? key : [key]).slice().sort();
  return selectedLabels.length === correctLabels.length && selectedLabels.every(function (label, index) { return label === correctLabels[index]; });
}
function practiceAnswers(number) {
  if (!state.answers[number]) state.answers[number] = {};
  return state.answers[number];
}
function currentChapter() { return chapterData(state.activeChapter); }
function currentQuestions() { const data = currentChapter(); return data ? data.questions : []; }
function readyQuestions(number) {
  const data = chapterData(number);
  return data ? data.questions.filter(isReady) : [];
}
function keyedReadyQuestions(number) {
  const keys = chapterAnswers(number);
  return readyQuestions(number).filter(function (question) { return isGradeableKey(question, keys[question.id]); });
}
function answerCount(number) {
  const saved = state.answers[number] || {};
  const questions = readyQuestions(number);
  const keys = chapterAnswers(number);
  return questions.filter(function (question) { return isAnswered(question, saved[question.id], keys[question.id]); }).length;
}
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
    if (button.hasAttribute("aria-selected")) button.setAttribute("aria-selected", String(button.dataset.mode === mode));
  });
  document.getElementById("practicePanel").classList.toggle("hidden", mode !== "practice");
  document.getElementById("mockPanel").classList.toggle("hidden", mode !== "mock");
  document.getElementById("dashboardPanel").classList.toggle("hidden", mode !== "dashboard");
  if (mode === "mock") renderMockAvailability();
  if (mode === "dashboard") renderDashboard();
}
function renderChapters() {
  const list = document.getElementById("chapterList");
  list.innerHTML = CHAPTERS.map(function (entry) {
    const data = chapterData(entry.number);
    const title = data ? data.title : entry.fallback;
    const count = data ? readyQuestions(entry.number).length + "문항" : "준비 중";
    return '<button type="button" class="chapter-item ' + (entry.number === state.activeChapter ? "is-active" : "") + '" data-chapter="' + entry.number + '" ' + (data ? "" : "disabled") + ' aria-label="챕터 ' + entry.number + " " + escapeHTML(title) + (data ? ' 선택' : ' 준비 중') + '">' +
      '<span class="chapter-num">' + String(entry.number).padStart(2, "0") + '</span><span class="chapter-copy"><b>' + escapeHTML(title) + '</b><small>' + count + '</small></span><span class="chapter-tail">' + (data ? "↗" : "·") + '</span></button>';
  }).join("");
  list.querySelectorAll("[data-chapter]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.activeChapter = Number(button.dataset.chapter);
      state.activeIndex = 0;
      renderChapters();
      renderPractice();
    });
  });
}
function renderProgress() {
  const data = currentChapter();
  const total = data ? readyQuestions(state.activeChapter).length : 0;
  const done = answerCount(state.activeChapter);
  const percent = total ? Math.round(done * 100 / total) : 0;
  const loadedChapters = CHAPTERS.filter(function (chapter) { return Boolean(chapterData(chapter.number)); });
  const totalAvailable = loadedChapters.reduce(function (sum, chapter) { return sum + readyQuestions(chapter.number).length; }, 0);
  document.getElementById("answeredCount").textContent = done;
  document.getElementById("progressTotal").textContent = " / " + total + " 문항 풀이";
  document.getElementById("progressPercent").textContent = percent;
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("chapterProgress").style.setProperty("--progress", percent + "%");
  document.getElementById("heroReady").textContent = loadedChapters.length ? loadedChapters.length + "개 장 포함 · " + totalAvailable + "문항 학습 가능" : "문제 자료 준비 중";
}
function renderIndex() {
  const data = currentChapter();
  const questions = data ? data.questions : [];
  const saved = state.answers[state.activeChapter] || {};
  const index = document.getElementById("questionIndex");
  document.getElementById("indexCount").textContent = String(questions.length).padStart(2, "0");
  index.innerHTML = questions.map(function (question, i) {
    const ready = isReady(question);
    const solved = isAnswered(question, saved[question.id], chapterAnswers(state.activeChapter)[question.id]);
    return '<button type="button" class="index-button ' + (i === state.activeIndex ? "is-current " : "") + (solved ? "is-solved" : "") + '" data-index="' + i + '" ' + (ready ? "" : 'disabled title="선택지 확인 중"') + ' aria-label="' + question.number + '번 문제' + (solved ? ', 풀이 완료' : '') + '">' + question.number + '</button>';
  }).join("");
  index.querySelectorAll("[data-index]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.activeIndex = Number(button.dataset.index);
      renderPractice();
      if (window.matchMedia("(max-width: 600px)").matches) document.querySelector(".question-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function renderFeedback(feedback, question, selected, correct) {
  feedback.className = "answer-feedback";
  if (!hasSelection(question, selected)) { feedback.textContent = ""; return; }
  if (!isGradeableKey(question, correct)) {
    feedback.textContent = correct !== undefined && correct !== null
      ? "원본 정답 표기가 선택지와 달라 이 문항은 자동 채점할 수 없어요."
      : "답안을 저장했어요. 정답 자료가 준비되면 바로 채점할게요.";
    return;
  }
  if (Array.isArray(correct) && !answerConfirmed(selected)) {
    feedback.textContent = "복수 선택을 마쳤다면 아래 버튼을 눌러 채점하세요.";
    return;
  }
  const isCorrect = responseIsCorrect(question, selected, correct);
  feedback.classList.add(isCorrect ? "is-correct" : "is-wrong");
  const correctText = (Array.isArray(correct) ? correct : [correct]).join(", ");
  feedback.textContent = isCorrect ? "정답이에요! 잘 풀었어요." : "아쉬워요. 정답은 " + correctText + "입니다.";
}
function renderChoices(container, question, selected, correct, disabled) {
  if (!question || !isReady(question)) { container.innerHTML = ""; return; }
  const selectedOptions = selectionIndexes(question, selected);
  const canReveal = isGradeableKey(question, correct) && hasSelection(question, selected) && (!Array.isArray(correct) || answerConfirmed(selected));
  const correctLabels = Array.isArray(correct) ? correct : [correct];
  container.innerHTML = question.choices.map(function (choice, index) {
    const chosen = selectedOptions.includes(index);
    const classes = ["choice-button"];
    if (chosen) classes.push("is-selected");
    if (canReveal && correctLabels.includes(choice.label)) classes.push("is-correct");
    if (canReveal && chosen && !correctLabels.includes(choice.label)) classes.push("is-wrong");
    return '<button type="button" class="' + classes.join(" ") + '" data-choice-index="' + index + '" ' + (disabled ? "disabled" : "") + '><span class="choice-label">' + escapeHTML(choice.label) + '</span><span>' + escapeHTML(choice.text) + '</span></button>';
  }).join("");
}
function renderPractice() {
  const data = currentChapter();
  renderProgress();
  renderIndex();
  const questions = currentQuestions();
  const question = questions[state.activeIndex];
  const ready = isReady(question);
  const activeQuestion = ready ? question : null;
  document.getElementById("chapterTitle").textContent = data ? data.title : "문제를 불러오고 있어요";
  document.getElementById("chapterSubtitle").textContent = data ? data.sourceTitle || "챕터의 모든 객관식 문제를 차례대로 풀어보세요." : "챕터를 선택해 문제 풀이를 시작하세요.";
  document.getElementById("questionNumber").textContent = question ? "QUESTION " + String(question.number).padStart(2, "0") : "QUESTION --";
  document.getElementById("questionStatus").textContent = ready ? "풀이 가능" : (question ? "문제 확인 중" : "문제 준비 중");
  document.getElementById("questionStatus").classList.toggle("incomplete", !ready);
  document.getElementById("questionPrompt").textContent = question ? question.prompt : "이 챕터의 문제 자료를 불러올 수 없습니다.";
  const selected = question && (state.answers[state.activeChapter] || {})[question.id];
  const correct = question ? chapterAnswers(state.activeChapter)[question.id] : null;
  const multiple = Array.isArray(correct);
  const checked = answerConfirmed(selected);
  renderChoices(document.getElementById("choiceList"), activeQuestion, selected, correct, Boolean(selected !== undefined && (!multiple || checked)));
  const feedback = document.getElementById("answerFeedback");
  renderFeedback(feedback, question, selected, correct);
  const checkAnswer = document.getElementById("checkAnswer");
  checkAnswer.classList.toggle("hidden", !multiple);
  checkAnswer.disabled = checked || !hasSelection(question, selected);
  checkAnswer.textContent = checked ? "채점 완료" : "선택 답안 확인";
  checkAnswer.onclick = function () {
    const latest = currentQuestions()[state.activeIndex];
    const latestSaved = practiceAnswers(state.activeChapter)[latest.id];
    if (!Array.isArray(chapterAnswers(state.activeChapter)[latest.id]) || !hasSelection(latest, latestSaved)) return;
    practiceAnswers(state.activeChapter)[latest.id] = { selected: selectionIndexes(latest, latestSaved), checked: true };
    saveProgress();
    renderPractice();
  };
  document.querySelectorAll("#choiceList [data-choice-index]").forEach(function (button) {
    button.addEventListener("click", function () {
      const latest = currentQuestions()[state.activeIndex];
      if (!isReady(latest)) return;
      const latestKey = chapterAnswers(state.activeChapter)[latest.id];
      const index = Number(button.dataset.choiceIndex);
      if (Array.isArray(latestKey)) {
        const latestSaved = practiceAnswers(state.activeChapter)[latest.id];
        if (answerConfirmed(latestSaved)) return;
        const selectedOptions = selectionIndexes(latest, latestSaved);
        const nextSelection = selectedOptions.includes(index) ? selectedOptions.filter(function (option) { return option !== index; }) : selectedOptions.concat(index);
        practiceAnswers(state.activeChapter)[latest.id] = { selected: nextSelection, checked: false };
      } else {
        if (practiceAnswers(state.activeChapter)[latest.id] !== undefined) return;
        practiceAnswers(state.activeChapter)[latest.id] = latest.choices[index].label;
      }
      saveProgress();
      renderPractice();
    });
  });
  const pos = (state.activeIndex + 1) + " / " + questions.length;
  document.getElementById("questionPosition").textContent = pos;
  document.getElementById("prevQuestion").disabled = state.activeIndex <= 0;
  document.getElementById("nextQuestion").disabled = state.activeIndex >= questions.length - 1;
}
function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function fullMockReady() {
  return CHAPTERS.every(function (chapter) { return keyedReadyQuestions(chapter.number).length >= 10; });
}
function renderMockAvailability() {
  const fullReady = fullMockReady();
  const card = document.getElementById("mockAvailability");
  const chapterButtons = CHAPTERS.map(function (chapter) {
    const available = keyedReadyQuestions(chapter.number).length >= 10;
    return '<button type="button" data-chapter-exam="' + chapter.number + '" ' + (available ? "" : "disabled") + '>챕터 ' + chapter.number + ' 10문항 시험 ' + (available ? "↗" : "· 정답 대기") + '</button>';
  }).join("");
  if (fullReady) {
    card.innerHTML = '<span class="availability-icon">✓</span><div class="availability-copy"><b>60문항 모의시험을 시작할 수 있어요.</b><p>각 챕터에서 정답이 있는 10문항을 무작위로 출제합니다. 챕터별 10문항 채점 시험도 선택할 수 있습니다.</p><div class="availability-actions"><button type="button" id="startFullMock" class="primary">전체 60문항 시험 시작 ↗</button>' + chapterButtons + '</div></div>';
    document.getElementById("startFullMock").addEventListener("click", startFullMock);
    card.querySelectorAll("[data-chapter-exam]").forEach(function (button) {
      button.addEventListener("click", function () { startChapterMock(Number(button.dataset.chapterExam), true); });
    });
  } else {
    const missingQuestions = CHAPTERS.filter(function (chapter) { return readyQuestions(chapter.number).length < 10; });
    const waitingKeys = CHAPTERS.filter(function (chapter) { return keyedReadyQuestions(chapter.number).length < 10; });
    const availability = [];
    if (missingQuestions.length) availability.push("문제 준비 중: " + missingQuestions.map(function (chapter) { return "챕터 " + chapter.number; }).join(" · "));
    if (waitingKeys.length) availability.push("정답 데이터 대기: " + waitingKeys.map(function (chapter) { return "챕터 " + chapter.number; }).join(" · "));
    const practiceButtons = CHAPTERS.map(function (chapter) {
      const available = readyQuestions(chapter.number).length >= 10;
      return '<button type="button" data-chapter-practice="' + chapter.number + '" ' + (available ? "" : "disabled") + '>챕터 ' + chapter.number + ' 10문항 연습 ' + (available ? "↗" : "· 준비 중") + '</button>';
    }).join("");
    const examButtons = chapterButtons;
    card.innerHTML = '<span class="availability-icon">⌁</span><div class="availability-copy"><b>전체 모의시험은 정답 자료 준비 후 열려요.</b><p>각 챕터 문제는 10문항씩 랜덤 연습할 수 있어요. 공식 정답 키가 준비된 챕터는 채점 시험도 열립니다.</p><div class="availability-meta">' + availability.join("<br>") + '</div><div class="availability-actions">' + practiceButtons + examButtons + '</div></div>';
    card.querySelectorAll("[data-chapter-practice]").forEach(function (button) {
      button.addEventListener("click", function () { startChapterMock(Number(button.dataset.chapterPractice), false); });
    });
    card.querySelectorAll("[data-chapter-exam]").forEach(function (button) {
      button.addEventListener("click", function () { startChapterMock(Number(button.dataset.chapterExam), true); });
    });
  }
}
function renderDashboard() {
  const history = state.examHistory.filter(function (record) { return record && Number(record.total) > 0; });
  const totals = history.reduce(function (sum, record) {
    sum.total += Number(record.total) || 0;
    sum.correct += Number(record.correct) || 0;
    return sum;
  }, { total: 0, correct: 0 });
  const accuracy = totals.total ? Math.round(totals.correct * 100 / totals.total) : null;
  document.getElementById("dashboardStats").innerHTML = [
    { label: "응시 횟수", value: history.length + "회", detail: "채점 완료한 모의고사" },
    { label: "누적 정답률", value: accuracy === null ? "—" : accuracy + "%", detail: totals.correct + " / " + totals.total + "문항 정답" },
    { label: "누적 오답률", value: accuracy === null ? "—" : (100 - accuracy) + "%", detail: accuracy === null ? "시험 기록이 쌓이면 표시돼요" : (totals.total - totals.correct) + "문항 오답 또는 미응답" }
  ].map(function (stat) {
    return '<article class="dashboard-stat"><span>' + stat.label + '</span><b>' + stat.value + '</b><small>' + stat.detail + '</small></article>';
  }).join("");

  const chapterTotals = new Map();
  history.forEach(function (record) {
    (Array.isArray(record.chapterStats) ? record.chapterStats : []).forEach(function (chapter) {
      const number = Number(chapter.number);
      if (!number) return;
      if (!chapterTotals.has(number)) chapterTotals.set(number, { correct: 0, total: 0 });
      const total = chapterTotals.get(number);
      total.correct += Number(chapter.correct) || 0;
      total.total += Number(chapter.total) || 0;
    });
  });
  const chapterRows = CHAPTERS.map(function (chapter) {
    const result = chapterTotals.get(chapter.number) || { correct: 0, total: 0 };
    const data = chapterData(chapter.number);
    return {
      number: chapter.number,
      title: data ? data.title : chapter.fallback,
      correct: result.correct,
      total: result.total,
      accuracy: result.total ? Math.round(result.correct * 100 / result.total) : null
    };
  }).sort(function (a, b) {
    if (a.accuracy === null) return b.accuracy === null ? a.number - b.number : 1;
    if (b.accuracy === null) return -1;
    return a.accuracy - b.accuracy || a.number - b.number;
  });
  const measuredChapters = chapterRows.filter(function (chapter) { return chapter.accuracy !== null; });
  document.getElementById("weakAreas").innerHTML = chapterRows.map(function (chapter, index) {
    const measured = chapter.accuracy !== null;
    const status = measured ? chapter.accuracy + "%" : "기록 없음";
    const detail = measured ? chapter.correct + " / " + chapter.total + "문항 정답" : "모의고사를 풀면 기록돼요";
    const classes = ["weak-area"];
    if (measured && index === 0) classes.push("is-weakest");
    if (measured && chapter.accuracy < 60) classes.push("needs-practice");
    return '<div class="' + classes.join(" ") + '"><div class="weak-area-top"><b>챕터 ' + chapter.number + ' · ' + escapeHTML(chapter.title) + '</b><strong>' + status + '</strong></div><div class="weak-area-track"><span style="width:' + (measured ? chapter.accuracy : 0) + '%"></span></div><small>' + detail + '</small></div>';
  }).join("");
  document.getElementById("weakAreaHint").textContent = measuredChapters.length
    ? "응시 기록에서 정답률이 낮은 챕터부터 보여드려요."
    : "모의고사를 제출하면 챕터별 정답률을 비교해 약한 부분을 보여드려요.";

  const recent = history.slice().sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); }).slice(0, 6);
  document.getElementById("recentAttempts").innerHTML = recent.length ? recent.map(function (record) {
    const rate = Math.round((Number(record.correct) || 0) * 100 / Number(record.total));
    const date = new Date(record.submittedAt);
    const dateText = Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
    return '<div class="recent-attempt"><div><b>' + escapeHTML(record.label || "모의고사") + '</b><small>' + escapeHTML(dateText) + '</small></div><span>' + record.correct + ' / ' + record.total + '</span><strong>' + rate + '%</strong></div>';
  }).join("") : '<p class="dashboard-empty-copy">아직 채점된 모의고사 기록이 없어요.</p>';
  document.getElementById("dashboardEmpty").classList.toggle("hidden", history.length > 0);
}
function startFullMock() {
  const items = [];
  CHAPTERS.forEach(function (chapter) {
    const number = chapter.number;
    shuffle(keyedReadyQuestions(number)).slice(0, 10).forEach(function (question) { items.push({ chapter: number, question: question }); });
  });
  beginMock(items, true);
}
function startChapterMock(number, graded) {
  const pool = graded ? keyedReadyQuestions(number) : readyQuestions(number);
  const items = shuffle(pool).slice(0, 10).map(function (question) { return { chapter: number, question: question }; });
  beginMock(items, graded);
}
function beginMock(items, graded) {
  state.attempt = { items: items, index: 0, responses: {}, graded: graded, submitted: false };
  document.getElementById("mockResult").classList.add("hidden");
  document.getElementById("mockAttempt").classList.remove("hidden");
  renderAttempt();
  document.getElementById("mockAttempt").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderAttempt() {
  const attempt = state.attempt;
  if (!attempt) return;
  const item = attempt.items[attempt.index];
  const saved = attempt.responses[item.question.id];
  // Mock answers stay hidden until submission, even when the key is available.
  const correct = null;
  document.getElementById("attemptChapter").textContent = "CHAPTER " + item.chapter + " · " + (chapterData(item.chapter).title || "");
  document.getElementById("attemptPosition").textContent = String(attempt.index + 1).padStart(2, "0") + " / " + String(attempt.items.length).padStart(2, "0");
  document.getElementById("attemptProgressBar").style.width = ((attempt.index + 1) * 100 / attempt.items.length) + "%";
  document.getElementById("attemptPrompt").textContent = item.question.prompt;
  renderChoices(document.getElementById("attemptChoices"), item.question, saved, correct, false);
  const feedback = document.getElementById("attemptFeedback");
  feedback.className = "answer-feedback";
  feedback.textContent = "";
  document.querySelectorAll("#attemptChoices [data-choice-index]").forEach(function (button) {
    button.addEventListener("click", function () {
      const index = Number(button.dataset.choiceIndex);
      const key = chapterAnswers(item.chapter)[item.question.id];
      if (Array.isArray(key)) {
        const selectedOptions = selectionIndexes(item.question, attempt.responses[item.question.id]);
        attempt.responses[item.question.id] = selectedOptions.includes(index)
          ? selectedOptions.filter(function (option) { return option !== index; })
          : selectedOptions.concat(index);
      } else {
        attempt.responses[item.question.id] = item.question.choices[index].label;
      }
      renderAttempt();
    });
  });
  document.getElementById("attemptPrev").disabled = attempt.index <= 0;
  document.getElementById("attemptNext").disabled = attempt.index >= attempt.items.length - 1;
  document.getElementById("attemptNext").querySelector("span").textContent = attempt.index >= attempt.items.length - 1 ? "마지막" : "다음";
  document.getElementById("submitMock").textContent = attempt.index === attempt.items.length - 1 ? "시험 제출하기 ↗" : "시험 제출하기 ·";
}
function responseLabels(item, response) {
  return selectionIndexes(item.question, response).map(function (index) {
    const choice = item.question.choices[index];
    return choice ? choice.label + ". " + choice.text : "";
  }).filter(Boolean);
}
function renderWrongNotes(attempt) {
  const notes = attempt.items.map(function (item, index) {
    const key = chapterAnswers(item.chapter)[item.question.id];
    if (responseIsCorrect(item.question, attempt.responses[item.question.id], key)) return null;
    const chosen = responseLabels(item, attempt.responses[item.question.id]);
    const correct = isGradeableKey(item.question, key)
      ? (Array.isArray(key) ? key : [key]).map(function (label) {
        const choice = item.question.choices.find(function (entry) { return entry.label === label; });
        return choice ? choice.label + ". " + choice.text : label;
      })
      : ["정답 확인 중"];
    const data = chapterData(item.chapter);
    return '<article class="wrong-note-item"><div class="wrong-meta"><b>시험 ' + String(index + 1).padStart(2, "0") + '번 · 챕터 ' + item.chapter + ' ' + escapeHTML(data ? data.title : "") + ' · 문제 ' + escapeHTML(item.question.number) + '</b></div><p class="wrong-prompt">' + escapeHTML(item.question.prompt) + '</p><p class="wrong-answer-line is-yours"><b>내 답</b><span>' + escapeHTML(chosen.length ? chosen.join(" / ") : "미응답") + '</span></p><p class="wrong-answer-line is-correct-answer"><b>정답</b><span>' + escapeHTML(correct.join(" / ")) + '</span></p></article>';
  }).filter(Boolean);
  if (!notes.length) return '<div class="wrong-note-empty"><b>모두 맞혔어요!</b><span>이번 시험에서 틀린 문제가 없습니다.</span></div>';
  return '<section class="wrong-note"><div class="wrong-note-heading"><div><span class="index-kicker">REVIEW</span><h3>오답노트</h3></div><span class="wrong-count">' + notes.length + '문항</span></div><div class="wrong-note-list">' + notes.join("") + '</div></section>';
}
function showUnansweredDialog(unanswered) {
  const groups = new Map();
  unanswered.forEach(function (entry) {
    if (!groups.has(entry.item.chapter)) groups.set(entry.item.chapter, []);
    groups.get(entry.item.chapter).push(entry);
  });
  document.getElementById("unansweredCount").textContent = unanswered.length;
  document.getElementById("unansweredList").innerHTML = Array.from(groups.entries()).map(function (entry) {
    const chapter = entry[0];
    const items = entry[1];
    const title = chapterData(chapter);
    return '<section class="unanswered-group"><h3>챕터 ' + chapter + ' · ' + escapeHTML(title ? title.title : "") + '</h3><div>' + items.map(function (missing) {
      return '<button type="button" class="unanswered-link" data-missing-index="' + missing.index + '"><span>시험 ' + String(missing.index + 1).padStart(2, "0") + '번</span><b>문제 ' + escapeHTML(missing.item.question.number) + '</b><span aria-hidden="true">↗</span></button>';
    }).join("") + '</div></section>';
  }).join("");
  document.getElementById("unansweredDialog").showModal();
}
function submitMock() {
  const attempt = state.attempt;
  if (!attempt || attempt.submitted) return;
  const results = new Map();
  let correctCount = 0;
  attempt.items.forEach(function (item) {
    if (!results.has(item.chapter)) results.set(item.chapter, { correct: 0, total: 0 });
    const chapterResult = results.get(item.chapter);
    chapterResult.total += 1;
    const key = chapterAnswers(item.chapter)[item.question.id];
    if (responseIsCorrect(item.question, attempt.responses[item.question.id], key)) { chapterResult.correct += 1; correctCount += 1; }
  });
  attempt.submitted = true;
  const score = Math.round(correctCount * 100 / attempt.items.length);
  const passedChapters = Array.from(results.values()).every(function (result) { return result.correct / result.total >= .4; });
  const isFullExam = attempt.graded && attempt.items.length === 60;
  const passed = isFullExam && score >= 60 && passedChapters;
  if (attempt.graded) {
    saveExamHistory({
      label: isFullExam ? "전체 모의시험" : "챕터 " + attempt.items[0].chapter + " 시험",
      submittedAt: new Date().toISOString(),
      total: attempt.items.length,
      correct: correctCount,
      score: score,
      passed: isFullExam ? passed : null,
      chapterStats: Array.from(results.entries()).map(function (entry) {
        return { number: entry[0], correct: entry[1].correct, total: entry[1].total };
      })
    });
  }
  const rows = Array.from(results.entries()).map(function (entry) {
    const number = entry[0], result = entry[1];
    const title = chapterData(number).title || "챕터 " + number;
    return '<div class="result-chapter ' + (result.correct / result.total < .4 ? "below" : "") + '"><span>챕터 ' + number + " · " + escapeHTML(title) + '</span><b>' + result.correct + " / " + result.total + " (" + Math.round(result.correct * 100 / result.total) + '%)</b></div>';
  }).join("");
  const resultNode = document.getElementById("mockResult");
  if (!attempt.graded) {
    resultNode.innerHTML = '<div class="result-score"><b>채점 대기</b></div><p class="result-note">공식 정답 데이터가 아직 없어 점수는 계산하지 않았어요. 답안은 제출 전까지 수정할 수 있습니다.</p><button type="button" id="restartMock" class="submit-button">다시 풀기 ↻</button>';
  } else if (isFullExam) {
    const verdict = passed ? "합격 기준을 충족했어요!" : "조금 더 연습해 보세요.";
    resultNode.innerHTML = '<div class="result-score"><b>' + score + '</b><span>/ 100점 · ' + correctCount + " / " + attempt.items.length + ' 정답</span></div><div class="result-verdict ' + (passed ? "pass" : "fail") + '">' + verdict + '</div><div class="result-chapters">' + rows + '</div><p class="result-note">합격 기준: 총점 60점 이상이며 모든 챕터 정답률이 40% 이상이어야 합니다.</p>' + renderWrongNotes(attempt) + '<div class="result-actions"><button type="button" id="restartMock" class="submit-button">다시 풀기 ↻</button><button type="button" class="dashboard-result-link" data-open-dashboard>성적 대시보드 보기 ↗</button></div>';
  } else {
    const chapterNumber = attempt.items[0].chapter;
    resultNode.innerHTML = '<div class="result-score"><b>' + score + '</b><span>/ 100점 · ' + correctCount + " / " + attempt.items.length + ' 정답</span></div><div class="result-verdict">챕터 연습 결과</div><div class="result-chapters">' + rows + '</div><p class="result-note">챕터 ' + chapterNumber + ' 연습 채점 결과예요. 전체 시험 합격 기준은 6개 챕터 모의시험에서 확인할 수 있어요.</p>' + (attempt.graded ? renderWrongNotes(attempt) : "") + '<div class="result-actions"><button type="button" id="restartMock" class="submit-button">다시 풀기 ↻</button>' + (attempt.graded ? '<button type="button" class="dashboard-result-link" data-open-dashboard>성적 대시보드 보기 ↗</button>' : "") + '</div>';
  }
  resultNode.classList.remove("hidden");
  document.getElementById("mockAttempt").classList.add("hidden");
  document.getElementById("restartMock").addEventListener("click", function () {
    beginMock(attempt.items, attempt.graded);
  });
  resultNode.querySelectorAll("[data-open-dashboard]").forEach(function (button) { button.addEventListener("click", function () { setMode("dashboard"); }); });
  resultNode.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function loadChapters() {
  await Promise.all(CHAPTERS.map(async function (entry) {
    try {
      const response = await fetch("./data/chapter-" + entry.number + ".json?v=" + DATA_VERSION);
      if (!response.ok) return;
      const data = await response.json();
      let answerData = null;
      try {
        const answerResponse = await fetch("./data/answers/chapter-" + entry.number + ".json?v=" + DATA_VERSION);
        if (answerResponse.ok) answerData = await answerResponse.json();
      } catch { /* Answer key files are added as they become available. */ }
      state.chapters.set(entry.number, { ...data, answerData: answerData });
    } catch (error) {
      console.info("Chapter " + entry.number + " data is not available yet.");
    }
  }));
  renderChapters();
  renderPractice();
  renderMockAvailability();
}

document.querySelectorAll("[data-mode]").forEach(function (button) { button.addEventListener("click", function () { setMode(button.dataset.mode); }); });
document.getElementById("prevQuestion").addEventListener("click", function () { state.activeIndex = Math.max(0, state.activeIndex - 1); renderPractice(); });
document.getElementById("nextQuestion").addEventListener("click", function () { state.activeIndex = Math.min(currentQuestions().length - 1, state.activeIndex + 1); renderPractice(); });
document.getElementById("resetChapter").addEventListener("click", function () {
  const title = currentChapter() ? currentChapter().title : "이 챕터";
  if (!window.confirm(title + "의 저장된 답안을 모두 지울까요?")) return;
  delete state.answers[state.activeChapter];
  saveProgress();
  renderPractice();
});
document.getElementById("attemptPrev").addEventListener("click", function () { if (state.attempt) { state.attempt.index = Math.max(0, state.attempt.index - 1); renderAttempt(); } });
document.getElementById("attemptNext").addEventListener("click", function () { if (state.attempt) { state.attempt.index = Math.min(state.attempt.items.length - 1, state.attempt.index + 1); renderAttempt(); } });
document.getElementById("submitMock").addEventListener("click", function () {
  if (!state.attempt || state.attempt.submitted) return;
  const unanswered = state.attempt.items.map(function (item, index) { return { item: item, index: index }; }).filter(function (entry) {
    return !hasSelection(entry.item.question, state.attempt.responses[entry.item.question.id]);
  });
  if (unanswered.length) showUnansweredDialog(unanswered);
  else submitMock();
});
document.getElementById("unansweredList").addEventListener("click", function (event) {
  const button = event.target.closest("[data-missing-index]");
  if (!button || !state.attempt) return;
  state.attempt.index = Number(button.dataset.missingIndex);
  document.getElementById("unansweredDialog").close();
  renderAttempt();
  document.getElementById("mockAttempt").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("attemptPrompt").focus({ preventScroll: true });
});
document.getElementById("continueMock").addEventListener("click", function () { document.getElementById("unansweredDialog").close(); });
document.getElementById("closeUnanswered").addEventListener("click", function () { document.getElementById("unansweredDialog").close(); });
document.getElementById("submitWithUnanswered").addEventListener("click", function () {
  document.getElementById("unansweredDialog").close();
  submitMock();
});
document.getElementById("unansweredDialog").addEventListener("click", function (event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
loadChapters();
