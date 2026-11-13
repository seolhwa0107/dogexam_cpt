(function () {
  "use strict";
  const KEY = "dogexam-cpt-anatomy-progress-v1";
  const DATA_URL = "./data/anatomy.json?v=20261113-1";
  const $ = function (id) { return document.getElementById(id); };
  const state = { data: null, loading: false, error: false, category: "body", view: "study", selected: null, figure: null, search: "", progress: readProgress() };
  function readProgress() {
    try { const data = JSON.parse(localStorage.getItem(KEY) || "{}"); return data && typeof data === "object" ? data : {}; }
    catch (_) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(KEY, JSON.stringify(state.progress)); } catch (_) { /* Continue without storage. */ }
  }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function shuffled(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function category() { return state.data && state.data.categories.find(function (c) { return c.id === state.category; }); }
  function entryFor(c, id) { return c.entries.find(function (entry) { return entry.id === id; }); }
  function figureFor(c, id) { return c.figures.find(function (figure) { return figure.id === id; }); }
  function norm(value) { return String(value || "").toLocaleLowerCase("ko").replace(/[\s·()_-]/g, ""); }
  function equivalents(entry) { return new Set([entry.name].concat(entry.aliases || []).map(norm).filter(Boolean)); }
  function overlaps(a, b) { return Array.from(equivalents(a)).some(function (value) { return equivalents(b).has(value); }); }
  function detailName(entry) { return entry.name + (entry.qualifier ? " · " + entry.qualifier : ""); }
  function studyEntries(c) {
    const q = state.search.trim().toLocaleLowerCase("ko");
    return c.entries.filter(function (entry) { return !q || [entry.name, entry.english, entry.description].concat(entry.aliases || []).join(" ").toLocaleLowerCase("ko").includes(q); });
  }
  function figureMarkup(figure, point, study) {
    if (!figure) return '<div class="anatomy-figure-empty">표시할 그림이 없어요.</div>';
    const maxWidth = Math.min(680, Math.round(figure.width / figure.height * 410));
    const marker = point ? '<span class="anatomy-marker" style="left:' + (Number(point.x) * 100) + '%;top:' + (Number(point.y) * 100) + '%" aria-hidden="true"><span></span></span>' : "";
    return '<div class="anatomy-figure-stage"><div class="anatomy-figure" style="max-width:' + maxWidth + 'px"><img src="' + esc(figure.src) + '" alt="' + (study ? esc(figure.title) : '견체 참고 그림. 표시한 부위의 명칭을 선택하세요.') + '" loading="lazy">' + marker + '</div></div>';
  }
  function initSelection(c) {
    let selected = entryFor(c, state.selected);
    if (!selected) { selected = c.entries[0]; state.selected = selected ? selected.id : null; }
    if (!figureFor(c, state.figure)) state.figure = selected && selected.positions.length ? selected.positions[0].image_id : c.figures[0] && c.figures[0].id;
  }
  function renderStudyVisual() {
    const c = category(); if (!c) return;
    const selected = entryFor(c, state.selected);
    const figure = figureFor(c, state.figure);
    const point = selected && selected.positions.find(function (position) { return position.image_id === state.figure; });
    const picker = c.figures.length > 1 ? '<label class="anatomy-figure-picker" for="anatomyFigureSelect">그림 선택<select id="anatomyFigureSelect">' + c.figures.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === state.figure ? ' selected' : '') + '>' + esc(f.title) + '</option>'; }).join("") + '</select></label>' : '<p class="anatomy-figure-caption">' + esc(figure ? figure.title : "") + '</p>';
    $("anatomyStudyVisual").innerHTML = picker + figureMarkup(figure, point, true) + '<p class="anatomy-figure-hint">' + (point ? '<span class="anatomy-dot"></span> 선택한 명칭의 위치' : '이 그림에는 선택한 부위의 표시 위치가 없어요.') + '</p>';
  }
  function updateStudyTermControls() {
    const list = $("anatomyTermList");
    const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth);
    $("anatomyTermPrev").disabled = list.scrollLeft <= 2;
    $("anatomyTermNext").disabled = maxScroll <= 2 || list.scrollLeft >= maxScroll - 2;
  }
  function renderStudyList(revealSelection) {
    const c = category(); if (!c) return;
    const list = $("anatomyTermList"); const previousScroll = list.scrollLeft;
    const entries = studyEntries(c);
    list.innerHTML = entries.map(function (entry, index) {
      const active = entry.id === state.selected;
      return '<button type="button" class="anatomy-term-item' + (active ? ' is-active' : '') + '" data-anatomy-term="' + esc(entry.id) + '" aria-pressed="' + active + '" aria-label="' + esc(detailName(entry)) + (entry.english ? ' · ' + esc(entry.english) : '') + ' · ' + (index + 1) + ' / ' + entries.length + '"><span>' + esc(detailName(entry)) + '</span></button>';
    }).join("");
    list.scrollLeft = previousScroll;
    $("anatomyListEmpty").classList.toggle("hidden", entries.length > 0);
    updateStudyTermControls();
    if (revealSelection) {
      const active = list.querySelector('[data-anatomy-term="' + esc(state.selected) + '"]');
      if (active) {
        if (revealSelection === "focus") active.focus({ preventScroll: true });
        const activeRect = active.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (activeRect.left < listRect.left) list.scrollBy({ left: activeRect.left - listRect.left - 8, behavior: "smooth" });
        else if (activeRect.right > listRect.right) list.scrollBy({ left: activeRect.right - listRect.right + 8, behavior: "smooth" });
      }
    }
    updateCarouselControls();
  }
  function renderDetail() {
    const c = category(); const entry = c && entryFor(c, state.selected);
    if (!entry) { $("anatomyDetail").innerHTML = ""; return; }
    const aliases = (entry.aliases || []).filter(function (a) { return norm(a) !== norm(entry.name); });
    const index = c.entries.findIndex(function (item) { return item.id === entry.id; });
    $("anatomyDetail").innerHTML = '<div class="anatomy-detail-top"><div class="anatomy-detail-title"><span>선택한 부위</span><h3>' + esc(detailName(entry)) + '</h3>' + (entry.english ? '<small>' + esc(entry.english) + '</small>' : '') + '</div><span class="anatomy-detail-count">' + String(index + 1).padStart(2, "0") + ' / ' + String(c.entries.length).padStart(2, "0") + '</span></div><div class="anatomy-detail-copy"><span class="anatomy-detail-label">부위 설명</span><p>' + esc(entry.description) + '</p>' + (aliases.length ? '<p class="anatomy-alias">함께 알아두기 · ' + aliases.map(esc).join(', ') + '</p>' : '') + (entry.note ? '<p class="anatomy-entry-note">' + esc(entry.note) + '</p>' : '') + '</div>';
  }
  function updateCarouselControls() {
    const c = category(); if (!c) return;
    const entries = studyEntries(c);
    const index = entries.findIndex(function (entry) { return entry.id === state.selected; });
    const position = $("anatomyCarouselPosition");
    position.textContent = entries.length ? String(index >= 0 ? index + 1 : 0).padStart(2, "0") + ' / ' + String(entries.length).padStart(2, "0") : '00 / 00';
    $("anatomyCarouselPrev").disabled = index <= 0;
    $("anatomyCarouselNext").disabled = index < 0 || index >= entries.length - 1;
  }
  function animateStudyCard(direction) {
    const card = $("anatomyStudyCard");
    card.classList.remove("slide-from-next", "slide-from-prev");
    void card.offsetWidth;
    card.classList.add(direction > 0 ? "slide-from-next" : "slide-from-prev");
    card.addEventListener("animationend", function () { card.classList.remove("slide-from-next", "slide-from-prev"); }, { once: true });
  }
  function showStudyEntry(entry, direction, revealSelection) {
    if (!entry) return;
    state.selected = entry.id;
    if (entry.positions.length) state.figure = entry.positions[0].image_id;
    renderStudyVisual(); renderStudyList(revealSelection); renderDetail(); updateCarouselControls();
    if (direction) animateStudyCard(direction);
  }
  function moveStudyEntry(direction) {
    const c = category(); if (!c) return;
    const entries = studyEntries(c);
    const index = entries.findIndex(function (entry) { return entry.id === state.selected; });
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return;
    showStudyEntry(entries[nextIndex], direction, "reveal");
  }
  function sessionFor(c) {
    const pool = c.entries.filter(function (entry) { return entry.quiz && entry.positions && entry.positions.length; });
    const ids = pool.map(function (entry) { return entry.id; });
    let p = state.progress[c.id];
    if (!p || !Array.isArray(p.order) || p.order.length !== ids.length || new Set(p.order).size !== ids.length || p.order.some(function (id) { return !ids.includes(id); })) {
      p = { order: shuffled(ids), cursor: 0, answers: {}, choices: {} }; state.progress[c.id] = p; saveProgress();
    }
    if (!p.answers || typeof p.answers !== "object") p.answers = {};
    if (!p.choices || typeof p.choices !== "object") p.choices = {};
    p.cursor = Math.max(0, Math.min(Number.isFinite(Number(p.cursor)) ? Math.floor(Number(p.cursor)) : 0, p.order.length));
    return p;
  }
  function choicesFor(c, entry, p) {
    const saved = p.choices[entry.id];
    const names = new Set(c.entries.map(function (e) { return e.name; }));
    if (Array.isArray(saved) && saved.length === 5 && new Set(saved).size === 5 && saved.includes(entry.name) && saved.every(function (name) { return names.has(name); })) return saved;
    const candidates = shuffled(c.entries.filter(function (other) { return other.name !== entry.name && !overlaps(other, entry); }));
    const picked = [entry];
    candidates.forEach(function (other) { if (picked.length < 5 && !picked.some(function (prior) { return overlaps(prior, other); })) picked.push(other); });
    if (picked.length < 5) {
      candidates.forEach(function (other) { if (picked.length < 5 && !picked.some(function (prior) { return prior.name === other.name; })) picked.push(other); });
    }
    const choices = shuffled(picked.map(function (e) { return e.name; }));
    p.choices[entry.id] = choices; saveProgress(); return choices;
  }
  function renderQuiz() {
    const c = category(); if (!c) return;
    const p = sessionFor(c); const total = p.order.length;
    const answered = p.order.filter(function (id) { return typeof p.answers[id] === "string"; });
    const correct = answered.filter(function (id) { const entry = entryFor(c, id); return entry && p.answers[id] === entry.name; }).length;
    $("anatomyQuizProgress").innerHTML = '<span><b>' + answered.length + '</b> / ' + total + '개 풀이 · 정답 <b>' + correct + '</b></span><button type="button" class="text-button" data-anatomy-action="restart">처음부터 다시 섞기 ↺</button>';
    $("anatomyQuizBar").style.width = (total ? answered.length / total * 100 : 0) + "%";
    if (!total) { $("anatomyQuestion").innerHTML = '<div class="glossary-empty">이 주제의 그림 문제를 준비하고 있어요.</div>'; return; }
    if (p.cursor >= total) {
      $("anatomyQuestion").innerHTML = '<div class="mock-result anatomy-result"><div class="result-score"><b>' + correct + '</b><span>/ ' + total + '개 정답 · 정답률 ' + Math.round(correct / total * 100) + '%</span></div><div class="result-verdict">이 주제의 문제를 모두 풀었어요.</div><div class="result-actions"><button type="button" class="outline-button" data-anatomy-action="prev">마지막 문제 보기</button><button type="button" class="submit-button" data-anatomy-action="restart">다시 풀기 · 순서 섞기 ↻</button></div></div>'; return;
    }
    const entry = entryFor(c, p.order[p.cursor]); if (!entry) return;
    const point = entry.positions[0]; const figure = figureFor(c, point.image_id);
    const selected = p.answers[entry.id]; const hasAnswer = typeof selected === "string";
    const options = choicesFor(c, entry, p); const labels = ["①", "②", "③", "④", "⑤"];
    const feedback = hasAnswer ? '<div class="answer-feedback ' + (selected === entry.name ? 'is-correct' : 'is-wrong') + '" role="status">' + (selected === entry.name ? '정답이에요!' : '정답은 ' + esc(entry.name) + '입니다.') + '<br>' + esc(entry.description) + '</div>' : '<div class="answer-feedback" role="status"></div>';
    $("anatomyQuestion").innerHTML = '<article class="question-card anatomy-question-card"><div class="question-meta"><span class="question-number">ANATOMY ' + String(p.cursor + 1).padStart(3, "0") + '</span><span class="status-pill' + (hasAnswer ? '' : ' incomplete') + '">' + (hasAnswer ? (selected === entry.name ? '정답' : '오답') : '선택 전') + '</span></div><h3 class="anatomy-question-title">표시된 부위의 명칭은 무엇일까요?</h3>' + figureMarkup(figure, point, false) + '<p class="anatomy-question-hint"><span class="anatomy-dot"></span> 표시된 위치를 확인해 주세요.</p><div class="choice-list anatomy-choice-list">' + options.map(function (option, index) {
      const classes = ["choice-button", "anatomy-choice"]; if (hasAnswer && option === selected) classes.push("is-selected"); if (hasAnswer && option === entry.name) classes.push("is-correct"); if (hasAnswer && option === selected && option !== entry.name) classes.push("is-wrong");
      return '<button type="button" class="' + classes.join(" ") + '" data-anatomy-answer="' + index + '"' + (hasAnswer ? ' disabled' : '') + '><span class="choice-label">' + labels[index] + '</span><span>' + esc(option) + '</span></button>';
    }).join("") + '</div>' + feedback + '<div class="question-actions"><button type="button" class="outline-button" data-anatomy-action="prev"' + (p.cursor === 0 ? ' disabled' : '') + '>← 이전</button><span class="position-label">' + (p.cursor + 1) + ' / ' + total + '</span><button type="button" class="solid-button" data-anatomy-action="next"' + (hasAnswer ? '' : ' disabled') + '>' + (p.cursor === total - 1 ? '결과 보기 ↗' : '다음 문제 →') + '</button></div></article>';
  }
  function render() {
    $("anatomyLoading").classList.toggle("hidden", !state.loading);
    $("anatomyError").classList.toggle("hidden", !state.error);
    $("anatomyContent").classList.toggle("hidden", !state.data);
    document.querySelectorAll("[data-anatomy-view]").forEach(function (button) { const active = button.dataset.anatomyView === state.view; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    if (!state.data) return;
    const c = category(); if (!c) return;
    initSelection(c);
    $("anatomyCategory").innerHTML = state.data.categories.map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === c.id ? ' selected' : '') + '>' + esc(item.title) + '</option>'; }).join("");
    const quizCount = c.entries.filter(function (entry) { return entry.quiz && entry.positions.length; }).length;
    $("anatomyCategoryCount").textContent = c.entries.length + '개 명칭 · 그림 문제 ' + quizCount + '개';
    $("anatomyStudy").classList.toggle("hidden", state.view !== "study"); $("anatomyQuiz").classList.toggle("hidden", state.view !== "quiz");
    if (state.view === "study") { $("anatomySearch").value = state.search; renderStudyVisual(); renderStudyList(); renderDetail(); }
    else renderQuiz();
  }
  async function load() {
    if (state.loading || state.data) return;
    state.loading = true; state.error = false; render();
    try {
      const response = await fetch(DATA_URL); if (!response.ok) throw new Error("Unable to load anatomy data");
      const data = await response.json(); if (!Array.isArray(data.categories) || !data.categories.length) throw new Error("No anatomy categories");
      state.data = data;
    } catch (_) { state.error = true; }
    state.loading = false; render();
  }
  window.renderAnatomySection = function () { if (!state.data && !state.error) load(); else render(); };
  document.querySelectorAll("[data-anatomy-view]").forEach(function (button) { button.addEventListener("click", function () { state.view = button.dataset.anatomyView === "quiz" ? "quiz" : "study"; render(); }); });
  $("anatomyCategory").addEventListener("change", function (event) { state.category = event.target.value; state.selected = null; state.figure = null; state.search = ""; render(); });
  $("anatomySearch").addEventListener("input", function (event) {
    state.search = event.target.value;
    const c = category(); const entries = c && studyEntries(c);
    if (entries && entries.length && !entries.some(function (entry) { return entry.id === state.selected; })) showStudyEntry(entries[0], 0, "reveal");
    else { renderStudyList(); updateCarouselControls(); }
  });
  $("anatomyStudyVisual").addEventListener("change", function (event) { if (event.target.id === "anatomyFigureSelect") { state.figure = event.target.value; renderStudyVisual(); } });
  $("anatomyTermList").addEventListener("scroll", updateStudyTermControls, { passive: true });
  $("anatomyTermPrev").addEventListener("click", function () { $("anatomyTermList").scrollBy({ left: -240, behavior: "smooth" }); });
  $("anatomyTermNext").addEventListener("click", function () { $("anatomyTermList").scrollBy({ left: 240, behavior: "smooth" }); });
  $("anatomyCarouselPrev").addEventListener("click", function () { moveStudyEntry(-1); });
  $("anatomyCarouselNext").addEventListener("click", function () { moveStudyEntry(1); });
  $("anatomyTermList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-anatomy-term]"); const c = category(); if (!button || !c) return;
    showStudyEntry(entryFor(c, button.dataset.anatomyTerm), 0, "focus");
  });
  const studyCard = $("anatomyStudyCard"); let studyPointer = null;
  studyCard.addEventListener("pointerdown", function (event) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button, select, input, a")) return;
    studyPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
  });
  studyCard.addEventListener("pointermove", function (event) {
    if (!studyPointer || studyPointer.id !== event.pointerId) return;
    const dx = event.clientX - studyPointer.x; const dy = event.clientY - studyPointer.y;
    if (!studyPointer.dragging && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      studyPointer.dragging = true; studyCard.classList.add("is-dragging");
      try { studyCard.setPointerCapture(event.pointerId); } catch (_) { /* Pointer capture is optional. */ }
    }
    if (studyPointer.dragging) {
      studyPointer.dx = dx; event.preventDefault();
      studyCard.style.setProperty("--anatomy-drag-x", Math.max(-88, Math.min(88, dx)) + "px");
    }
  });
  function finishStudyPointer(event) {
    if (!studyPointer || studyPointer.id !== event.pointerId) return;
    const swipe = studyPointer; studyPointer = null;
    studyCard.classList.remove("is-dragging"); studyCard.style.setProperty("--anatomy-drag-x", "0px");
    if (swipe.dragging && Math.abs(swipe.dx) >= 52) moveStudyEntry(swipe.dx < 0 ? 1 : -1);
  }
  studyCard.addEventListener("pointerup", finishStudyPointer);
  studyCard.addEventListener("pointercancel", finishStudyPointer);
  $("anatomyQuiz").addEventListener("click", function (event) {
    const c = category(); if (!c) return; const p = sessionFor(c);
    const answer = event.target.closest("[data-anatomy-answer]");
    if (answer) {
      const entry = entryFor(c, p.order[p.cursor]); if (!entry || p.answers[entry.id] !== undefined) return;
      const selected = choicesFor(c, entry, p)[Number(answer.dataset.anatomyAnswer)]; if (typeof selected !== "string") return;
      p.answers[entry.id] = selected; saveProgress(); renderQuiz(); return;
    }
    const control = event.target.closest("[data-anatomy-action]"); if (!control) return;
    const action = control.dataset.anatomyAction;
    if (action === "restart") { if (!window.confirm("이 주제의 그림 문제 진도를 초기화하고 다시 섞을까요?")) return; delete state.progress[c.id]; saveProgress(); renderQuiz(); return; }
    if (action === "prev" && p.cursor > 0) p.cursor--;
    else if (action === "next" && p.answers[p.order[p.cursor]] !== undefined) p.cursor = Math.min(p.order.length, p.cursor + 1);
    else return;
    saveProgress(); renderQuiz(); if (window.matchMedia("(max-width: 600px)").matches) $("anatomyQuiz").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}());
