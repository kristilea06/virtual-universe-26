const STORAGE_KEY = 'diary-stream-v1';

const defaultEntries = [
  {
    id: makeId(),
    title: 'First diary post',
    content: 'I started this stream to keep track of the small wins and thoughts that matter to me.',
    author: 'You',
    createdAt: new Date().toISOString(),
    comments: [
      {
        id: makeId(),
        author: 'Maya',
        content: 'This feels like a nice place to reflect and share.',
        createdAt: new Date().toISOString()
      }
    ]
  }
];

const entryForm = document.querySelector('#entryForm');
const entryList = document.querySelector('#entryList');
const entryTemplate = document.querySelector('#entryTemplate');

let entries = loadEntries();

entryForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = document.querySelector('#entryTitle').value.trim();
  const content = document.querySelector('#entryContent').value.trim();

  if (!title || !content) {
    return;
  }

  entries.unshift({
    id: makeId(),
    title,
    content,
    author: 'You',
    createdAt: new Date().toISOString(),
    comments: []
  });

  saveEntries();
  renderEntries();
  entryForm.reset();
});

entryList.addEventListener('submit', (event) => {
  const form = event.target;

  if (!form.matches('.comment-form')) {
    return;
  }

  event.preventDefault();

  const entryId = form.dataset.entryId;
  const entry = entries.find((item) => item.id === entryId);

  if (!entry) {
    return;
  }

  const authorInput = form.querySelector('.commenter-name');
  const textInput = form.querySelector('.comment-text');
  const author = authorInput.value.trim();
  const content = textInput.value.trim();

  if (!author || !content) {
    return;
  }

  entry.comments.push({
    id: makeId(),
    author,
    content,
    createdAt: new Date().toISOString()
  });

  saveEntries();
  renderEntries();
});

function renderEntries() {
  if (!entries.length) {
    entryList.innerHTML = '<p class="empty-note">No diary entries yet. Post something to start the stream.</p>';
    return;
  }

  entryList.innerHTML = '';

  entries.forEach((entry) => {
    const fragment = entryTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.entry-card');
    const authorEl = fragment.querySelector('.entry-author');
    const dateEl = fragment.querySelector('.entry-date');
    const titleEl = fragment.querySelector('.entry-title');
    const textEl = fragment.querySelector('.entry-text');
    const commentsList = fragment.querySelector('.comments-list');
    const commentForm = fragment.querySelector('.comment-form');

    authorEl.textContent = entry.author;
    dateEl.textContent = formatDate(entry.createdAt);
    titleEl.textContent = entry.title;
    textEl.textContent = entry.content;
    commentForm.dataset.entryId = entry.id;

    if (!entry.comments.length) {
      const li = document.createElement('li');
      li.textContent = 'No comments yet. Be the first one to respond.';
      commentsList.appendChild(li);
    } else {
      entry.comments.forEach((comment) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.author)}</span>
            <span>${formatDate(comment.createdAt)}</span>
          </div>
          <p class="comment-content">${escapeHtml(comment.content)}</p>
        `;
        commentsList.appendChild(li);
      });
    }

    entryList.appendChild(fragment);
  });
}

function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return defaultEntries;
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultEntries;
  } catch (error) {
    return defaultEntries;
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

renderEntries();
