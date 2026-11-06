const CHAPTERS = [
  { number: 1, fallback: "안전위생관리" },
  { number: 2, fallback: "챕터 2" },
  { number: 3, fallback: "챕터 3" },
  { number: 4, fallback: "챕터 4" },
  { number: 5, fallback: "챕터 5" },
  { number: 6, fallback: "챕터 6" }
];
const STORAGE_KEY = "dogexam-cpt-progress-v1";
const state = {
  chapters: new Map(),
  answers: readProgress(),
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
  return readyQuestions(number).filter(function (question) { return Boolean(keys[question.id]); });
}
function answerCount(number) {
  const saved = state.answers[number] || {};
  const questions = readyQuestions(number);
  return questions.filter(function (question) { return saved[question.id] !== undefined; }).length;
}
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  document.getElementById("practicePanel").classList.toggle("hidden", mode !== "practice");
  document.getElementById("mockPanel").classList.toggle("hidden", mode !== "mock");
  if (mode === "mock") renderMockAvailability();
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
    const solved = saved[question.id] !== undefined;
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
function renderFeedback(feedback, chosen, correct) {
  feedback.className = "answer-feedback";
  if (chosen === undefined) { feedback.textContent = ""; return; }
  if (!correct) {
    feedback.textContent = "답안을 저장했어요. 정답 자료가 준비되면 바로 채점할게요.";
    return;
  }
  const isCorrect = chosen === correct;
  feedback.classList.add(isCorrect ? "is-correct" : "is-wrong");
  feedback.textContent = isCorrect ? "정답이에요! 잘 풀었어요." : "아쉬워요. 정답은 " + correct + "입니다.";
}
function renderChoices(container, question, selected, correct, disabled) {
  if (!question || !isReady(question)) { container.innerHTML = ""; return; }
  container.innerHTML = question.choices.map(function (choice) {
    const chosen = selected === choice.label;
    const classes = ["choice-button"];
    if (chosen) classes.push("is-selected");
    if (correct && choice.label === correct) classes.push("is-correct");
    if (correct && chosen && selected !== correct) classes.push("is-wrong");
    return '<button type="button" class="' + classes.join(" ") + '" data-choice="' + escapeHTML(choice.label) + '" ' + (disabled ? "disabled" : "") + '><span class="choice-label">' + escapeHTML(choice.label) + '</span><span>' + escapeHTML(choice.text) + '</span></button>';
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
  renderChoices(document.getElementById("choiceList"), activeQuestion, selected, correct, Boolean(correct && selected));
  const feedback = document.getElementById("answerFeedback");
  renderFeedback(feedback, selected, correct);
  document.querySelectorAll("#choiceList [data-choice]").forEach(function (button) {
    button.addEventListener("click", function () {
      const latest = currentQuestions()[state.activeIndex];
      if (!isReady(latest)) return;
      practiceAnswers(state.activeChapter)[latest.id] = button.dataset.choice;
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
  if (fullReady) {
    card.innerHTML = '<span class="availability-icon">✓</span><div class="availability-copy"><b>60문항 모의시험을 시작할 수 있어요.</b><p>각 챕터의 정답이 있는 문제 중 10개를 무작위로 출제합니다. 답안은 제출 전까지 수정할 수 있어요.</p><div class="availability-actions"><button type="button" id="startFullMock" class="primary">모의시험 시작하기 ↗</button></div></div>';
    document.getElementById("startFullMock").addEventListener("click", startFullMock);
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
    const examButtons = CHAPTERS.map(function (chapter) {
      const available = keyedReadyQuestions(chapter.number).length >= 10;
      return '<button type="button" data-chapter-exam="' + chapter.number + '" ' + (available ? "" : "disabled") + '>챕터 ' + chapter.number + ' 채점 시험 ' + (available ? "↗" : "· 정답 대기") + '</button>';
    }).join("");
    card.innerHTML = '<span class="availability-icon">⌁</span><div class="availability-copy"><b>전체 모의시험은 정답 자료 준비 후 열려요.</b><p>각 챕터 문제는 10문항씩 랜덤 연습할 수 있어요. 공식 정답 키가 준비된 챕터는 채점 시험도 열립니다.</p><div class="availability-meta">' + availability.join("<br>") + '</div><div class="availability-actions">' + practiceButtons + examButtons + '</div></div>';
    card.querySelectorAll("[data-chapter-practice]").forEach(function (button) {
      button.addEventListener("click", function () { startChapterMock(Number(button.dataset.chapterPractice), false); });
    });
    card.querySelectorAll("[data-chapter-exam]").forEach(function (button) {
      button.addEventListener("click", function () { startChapterMock(Number(button.dataset.chapterExam), true); });
    });
  }
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
  document.querySelectorAll("#attemptChoices [data-choice]").forEach(function (button) {
    button.addEventListener("click", function () {
      attempt.responses[item.question.id] = button.dataset.choice;
      renderAttempt();
    });
  });
  document.getElementById("attemptPrev").disabled = attempt.index <= 0;
  document.getElementById("attemptNext").disabled = attempt.index >= attempt.items.length - 1;
  document.getElementById("attemptNext").querySelector("span").textContent = attempt.index >= attempt.items.length - 1 ? "마지막" : "다음";
  document.getElementById("submitMock").textContent = attempt.index === attempt.items.length - 1 ? "시험 제출하기 ↗" : "시험 제출하기 ·";
}
function submitMock() {
  const attempt = state.attempt;
  if (!attempt) return;
  const results = new Map();
  let correctCount = 0;
  attempt.items.forEach(function (item) {
    if (!results.has(item.chapter)) results.set(item.chapter, { correct: 0, total: 0 });
    const chapterResult = results.get(item.chapter);
    chapterResult.total += 1;
    const key = chapterAnswers(item.chapter)[item.question.id];
    if (key && attempt.responses[item.question.id] === key) { chapterResult.correct += 1; correctCount += 1; }
  });
  attempt.submitted = true;
  const score = Math.round(correctCount * 100 / attempt.items.length);
  const passedChapters = Array.from(results.values()).every(function (result) { return result.correct / result.total >= .4; });
  const isFullExam = attempt.graded && attempt.items.length === 60;
  const passed = isFullExam && score >= 60 && passedChapters;
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
    resultNode.innerHTML = '<div class="result-score"><b>' + score + '</b><span>/ 100점 · ' + correctCount + " / " + attempt.items.length + ' 정답</span></div><div class="result-verdict ' + (passed ? "pass" : "fail") + '">' + verdict + '</div><div class="result-chapters">' + rows + '</div><p class="result-note">합격 기준: 총점 60점 이상이며 모든 챕터 정답률이 40% 이상이어야 합니다.</p><button type="button" id="restartMock" class="submit-button">다시 풀기 ↻</button>';
  } else {
    resultNode.innerHTML = '<div class="result-score"><b>' + score + '</b><span>/ 100점 · ' + correctCount + " / " + attempt.items.length + ' 정답</span></div><div class="result-verdict">챕터 연습 결과</div><div class="result-chapters">' + rows + '</div><p class="result-note">이 결과는 1장 연습 채점입니다. 전체 시험 합격 여부는 6개 챕터 모의시험에서 확인할 수 있어요.</p><button type="button" id="restartMock" class="submit-button">다시 풀기 ↻</button>';
  }
  resultNode.classList.remove("hidden");
  document.getElementById("mockAttempt").classList.add("hidden");
  document.getElementById("restartMock").addEventListener("click", function () {
    resultNode.classList.add("hidden");
    document.getElementById("mockAttempt").classList.remove("hidden");
    state.attempt.index = 0;
    renderAttempt();
  });
  resultNode.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function loadChapters() {
  await Promise.all(CHAPTERS.map(async function (entry) {
    try {
      const response = await fetch("./data/chapter-" + entry.number + ".json");
      if (!response.ok) return;
      const data = await response.json();
      let answerData = null;
      try {
        const answerResponse = await fetch("./data/answers/chapter-" + entry.number + ".json");
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
  if (!state.attempt) return;
  const unanswered = state.attempt.items.filter(function (item) { return state.attempt.responses[item.question.id] === undefined; }).length;
  const message = unanswered ? unanswered + "문항을 풀지 않았어요. 지금 제출할까요?" : "시험을 제출할까요?";
  if (window.confirm(message)) submitMock();
});
loadChapters();
