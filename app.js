const PROGRESS_KEY = 'praat-progress-v2';
const RECENT_LIMIT = 4;

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
    if (parsed?.version === 2 && parsed.cards && typeof parsed.cards === 'object') return parsed;
  } catch (_) { /* use a clean record */ }
  return { version: 2, cards: {} };
}

const state = {
  cards: [], index: 0, flipped: false, progress: loadProgress(), recent: [],
  sessionReviewed: new Set(), sound: localStorage.getItem('praat-sound') !== 'off',
  filter: 'all', query: ''
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function inline(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function markdown(md) {
  const lines = md.split('\n'); let html = ''; let list = false;
  const closeList = () => { if (list) { html += '</ul>'; list = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (line.startsWith('- ')) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else { closeList(); html += `<p class="${line.startsWith('💡') ? 'tip' : ''}">${inline(line)}</p>`; }
  }
  closeList(); return html;
}

function current() { return state.cards[state.index]; }
function pad(n) { return String(n).padStart(2, '0'); }
function recordFor(id) { return state.progress.cards[id]; }
function difficultyFor(id) { return recordFor(id)?.difficulty || 'unrated'; }
function saveProgress() { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); }

function migrateKnownCards() {
  let known = [];
  try { known = JSON.parse(localStorage.getItem('praat-known') || '[]'); } catch (_) { return; }
  for (const id of known) {
    if (!state.progress.cards[id]) state.progress.cards[id] = { difficulty: 'easy', reviewCount: 1, migrated: true };
  }
  if (known.length) { saveProgress(); localStorage.removeItem('praat-known'); }
}

function promptFor(card) {
  if (card.prompt) return card.prompt;
  if (card.direction === 'en-nl') return 'How would you say this in Dutch?';
  if (card.direction === 'concept') return 'Can you explain the rule?';
  return 'What does this mean?';
}

function renderStats() {
  const hard = state.cards.filter(card => difficultyFor(card.id) === 'hard').length;
  $('#progress-number').textContent = state.sessionReviewed.size;
  $('#progress-total').textContent = `/ ${state.cards.length}`;
  $('#progress-bar').style.width = `${state.sessionReviewed.size / state.cards.length * 100}%`;
  $('#hard-count').textContent = hard;
  $('#card-count').textContent = `${pad(state.cards.length)} CARDS`;
  $('#progress-message').textContent = state.sessionReviewed.size ? 'Your ratings shape what comes next.' : 'Hard cards return more often.';
}

function renderCard() {
  const card = current(); if (!card) return;
  $('#front-word').textContent = card.front || card.dutch;
  $('.prompt-label').textContent = promptFor(card);
  $('#front-category').textContent = card.category.toUpperCase();
  $('#back-category').textContent = `${card.category.toUpperCase()} · ${difficultyFor(card.id).toUpperCase()}`;
  $('#card-index').textContent = `${pad(state.index + 1)} / ${pad(state.cards.length)}`;
  $('#answer-content').innerHTML = markdown(card.markdown);
  $('#answer-content').scrollTop = 0;
  const englishFront = card.direction === 'en-nl' || card.frontLanguage === 'en';
  $('#speak-button').hidden = englishFront;
  $('#flashcard').dataset.direction = card.direction || 'nl-en';
  $('#flashcard').classList.remove('flipped'); state.flipped = false; $('#actions').hidden = true;
  renderStats();
}

function flip(force) {
  state.flipped = typeof force === 'boolean' ? force : !state.flipped;
  $('#flashcard').classList.toggle('flipped', state.flipped); $('#actions').hidden = !state.flipped;
}

function speak() {
  if (!state.sound || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(current().speech || current().dutch);
  utterance.lang = 'nl-NL'; utterance.rate = .82; speechSynthesis.speak(utterance);
}

function selectionWeight(card) {
  const weights = { hard: 7, medium: 3, easy: 1, unrated: 4 };
  let weight = weights[difficultyFor(card.id)];
  const recentIndex = state.recent.lastIndexOf(card.id);
  if (recentIndex !== -1) weight *= recentIndex === state.recent.length - 1 ? 0 : .18;
  const reviewed = recordFor(card.id)?.lastReviewedAt;
  if (reviewed) {
    const days = Math.max(0, (Date.now() - Date.parse(reviewed)) / 86400000);
    weight *= 1 + Math.min(days / 10, 1.5);
  }
  return weight;
}

function pickNextIndex() {
  if (state.cards.length < 2) return 0;
  const weighted = state.cards.map((card, index) => ({ index, weight: selectionWeight(card) }));
  let total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return (state.index + 1) % state.cards.length;
  let roll = Math.random() * total;
  for (const item of weighted) { roll -= item.weight; if (roll <= 0) return item.index; }
  return weighted.at(-1).index;
}

function rate(difficulty) {
  const card = current(); const previous = recordFor(card.id) || {};
  state.progress.cards[card.id] = {
    ...previous, difficulty, reviewCount: (previous.reviewCount || 0) + 1,
    lastReviewedAt: new Date().toISOString()
  };
  state.sessionReviewed.add(card.id);
  state.recent.push(card.id); if (state.recent.length > RECENT_LIMIT) state.recent.shift();
  saveProgress(); state.index = pickNextIndex(); renderCard(); renderLibrary();
}

function renderLibrary() {
  const q = state.query.toLowerCase();
  const cards = state.cards.filter(card => {
    const difficulty = difficultyFor(card.id);
    return (state.filter === 'all' || state.filter === difficulty) &&
      `${card.front || ''} ${card.dutch} ${card.english} ${card.category}`.toLowerCase().includes(q);
  });
  $('#library-grid').innerHTML = cards.map(card => {
    const difficulty = difficultyFor(card.id);
    return `<article class="library-card ${difficulty}" data-id="${card.id}" tabindex="0">
      <span class="status"><i></i>${difficulty.toUpperCase()} · ${card.category.toUpperCase()}</span>
      <h2>${inline(card.front || card.dutch)}</h2><p>${inline(card.direction === 'en-nl' ? 'English → Dutch' : card.english)}</p></article>`;
  }).join('');
  $('#result-count').textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`; $('#empty-state').hidden = cards.length > 0;
  $$('.library-card').forEach(el => {
    el.addEventListener('click', () => openCard(el.dataset.id));
    el.addEventListener('keydown', event => { if (event.key === 'Enter') openCard(el.dataset.id); });
  });
}

function openCard(id) {
  state.index = state.cards.findIndex(card => card.id === id); switchView('study'); renderCard(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchView(view) {
  $('#study-view').hidden = view !== 'study'; $('#library-view').hidden = view !== 'library';
  $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'library') renderLibrary();
}

function exportProgress() {
  const payload = JSON.stringify({ ...state.progress, exportedAt: new Date().toISOString() }, null, 2);
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = `praat-progress-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.version !== 2 || !data.cards || typeof data.cards !== 'object') throw new Error('Unsupported progress file');
    state.progress = { version: 2, cards: data.cards }; saveProgress(); renderStats(); renderLibrary();
  } catch (error) { alert(`Could not import progress: ${error.message}`); }
}

async function init() {
  try { const response = await fetch('cards.json'); if (!response.ok) throw new Error('Could not load cards'); state.cards = await response.json(); }
  catch (error) { document.querySelector('main').innerHTML = `<p class="empty-state">${error.message}. Please refresh the page.</p>`; return; }
  migrateKnownCards(); renderCard(); renderLibrary();
  $('#sound-toggle').setAttribute('aria-pressed', state.sound); $('.sound-label').textContent = state.sound ? 'Sound on' : 'Sound off';
}

$('#flashcard').addEventListener('click', event => {
  if (event.target.closest('#speak-button, #answer-speak-button, .answer-scroll')) return; flip();
});
$('#flashcard').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); } });
$('#speak-button').addEventListener('click', event => { event.stopPropagation(); speak(); });
$('#answer-speak-button').addEventListener('click', event => { event.stopPropagation(); speak(); });
$('#sound-toggle').addEventListener('click', () => { state.sound = !state.sound; localStorage.setItem('praat-sound', state.sound ? 'on' : 'off'); $('#sound-toggle').setAttribute('aria-pressed', state.sound); $('.sound-label').textContent = state.sound ? 'Sound on' : 'Sound off'; });
$$('.nav-link').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$$('.action-button').forEach(button => button.addEventListener('click', () => rate(button.dataset.rating)));
$$('.filter').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('.filter').forEach(b => b.classList.toggle('active', b === button)); renderLibrary(); }));
$('#search-input').addEventListener('input', event => { state.query = event.target.value; renderLibrary(); });
$('#export-progress').addEventListener('click', exportProgress);
$('#import-progress').addEventListener('click', () => $('#progress-file').click());
$('#progress-file').addEventListener('change', event => { if (event.target.files[0]) importProgress(event.target.files[0]); event.target.value = ''; });
document.addEventListener('keydown', event => {
  if ($('#study-view').hidden || ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.key === ' ') { event.preventDefault(); flip(); }
  if (state.flipped && event.key === '1') rate('easy');
  if (state.flipped && event.key === '2') rate('medium');
  if (state.flipped && event.key === '3') rate('hard');
});
init();
