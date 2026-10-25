const state = {
  cards: [], index: 0, flipped: false,
  known: new Set(JSON.parse(localStorage.getItem('praat-known') || '[]')),
  sound: localStorage.getItem('praat-sound') !== 'off', filter: 'all', query: ''
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
function saveKnown() { localStorage.setItem('praat-known', JSON.stringify([...state.known])); }

function renderCard() {
  const card = current(); if (!card) return;
  $('#front-word').textContent = card.dutch;
  $('#front-category').textContent = card.category.toUpperCase();
  $('#back-category').textContent = card.category.toUpperCase();
  $('#card-index').textContent = `${pad(state.index + 1)} / ${pad(state.cards.length)}`;
  $('#answer-content').innerHTML = markdown(card.markdown);
  $('#flashcard').classList.remove('flipped'); state.flipped = false; $('#actions').hidden = true;
  const done = state.known.size;
  $('#progress-number').textContent = done; $('#progress-total').textContent = `/ ${state.cards.length}`;
  $('#progress-bar').style.width = `${done / state.cards.length * 100}%`;
  $('#known-count').textContent = done; $('#card-count').textContent = `${pad(state.cards.length)} CARDS`;
  $('#progress-message').textContent = done === state.cards.length ? 'Mooi! You know them all.' : 'One phrase at a time.';
}

function flip(force) {
  state.flipped = typeof force === 'boolean' ? force : !state.flipped;
  $('#flashcard').classList.toggle('flipped', state.flipped); $('#actions').hidden = !state.flipped;
}

function speak() {
  if (!state.sound || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(current().dutch);
  utterance.lang = 'nl-NL'; utterance.rate = .82; speechSynthesis.speak(utterance);
}

function rate(rating) {
  if (rating === 'known') state.known.add(current().id); else state.known.delete(current().id);
  saveKnown(); state.index = (state.index + 1) % state.cards.length; renderCard(); renderLibrary();
}

function renderLibrary() {
  const q = state.query.toLowerCase();
  const cards = state.cards.filter(card => {
    const statusMatch = state.filter === 'all' || (state.filter === 'known') === state.known.has(card.id);
    return statusMatch && `${card.dutch} ${card.english} ${card.category}`.toLowerCase().includes(q);
  });
  $('#library-grid').innerHTML = cards.map(card => `<article class="library-card ${state.known.has(card.id) ? 'known' : ''}" data-id="${card.id}" tabindex="0">
    <span class="status">${state.known.has(card.id) ? '✓ LEARNED' : card.category.toUpperCase()}</span><h2>${card.dutch}</h2><p>${card.english}</p></article>`).join('');
  $('#result-count').textContent = `${cards.length} ${cards.length === 1 ? 'phrase' : 'phrases'}`; $('#empty-state').hidden = cards.length > 0;
  $$('.library-card').forEach(el => el.addEventListener('click', () => openCard(el.dataset.id)));
}

function openCard(id) {
  state.index = state.cards.findIndex(card => card.id === id); switchView('study'); renderCard(); window.scrollTo({top:0,behavior:'smooth'});
}

function switchView(view) {
  $('#study-view').hidden = view !== 'study'; $('#library-view').hidden = view !== 'library';
  $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'library') renderLibrary();
}

async function init() {
  try { const response = await fetch('cards.json'); if (!response.ok) throw new Error('Could not load cards'); state.cards = await response.json(); }
  catch (error) { document.querySelector('main').innerHTML = `<p class="empty-state">${error.message}. Please refresh the page.</p>`; return; }
  renderCard(); renderLibrary();
  $('#sound-toggle').setAttribute('aria-pressed', state.sound); $('#sound-toggle').querySelector('.sound-label').textContent = state.sound ? 'Sound on' : 'Sound off';
}

$('#flashcard').addEventListener('click', e => {
  if (e.target.closest('#speak-button') || e.target.closest('.answer-scroll')) return;
  flip();
});
$('#flashcard').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
$('#speak-button').addEventListener('click', e => { e.stopPropagation(); speak(); });
$('#sound-toggle').addEventListener('click', () => { state.sound = !state.sound; localStorage.setItem('praat-sound', state.sound ? 'on' : 'off'); $('#sound-toggle').setAttribute('aria-pressed', state.sound); $('.sound-label').textContent = state.sound ? 'Sound on' : 'Sound off'; });
$$('.nav-link').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$$('.action-button').forEach(button => button.addEventListener('click', () => rate(button.dataset.rating)));
$$('.filter').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('.filter').forEach(b => b.classList.toggle('active', b === button)); renderLibrary(); }));
$('#search-input').addEventListener('input', e => { state.query = e.target.value; renderLibrary(); });
document.addEventListener('keydown', e => { if (!$('#study-view').hidden && !['INPUT','TEXTAREA'].includes(e.target.tagName)) { if (e.key === ' ') { e.preventDefault(); flip(); } if (state.flipped && e.key === '1') rate('again'); if (state.flipped && e.key === '2') rate('known'); } });
init();
