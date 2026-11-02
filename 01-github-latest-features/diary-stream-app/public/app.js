const loginForm = document.querySelector('#loginForm');
const privateAccessPanel = document.querySelector('#privateAccessPanel');
const logoutBtn = document.querySelector('#logoutBtn');
const entryForm = document.querySelector('#entryForm');
const entryList = document.querySelector('#entryList');
const ownerCommunityPostForm = document.querySelector('#ownerCommunityPostForm');
const communityPostForm = document.querySelector('#communityPostForm');
const communityPostList = document.querySelector('#communityPostList');
const communityPostStatus = document.querySelector('#communityPostStatus');
const aiFeedStatus = document.querySelector('#aiFeedStatus');
const ownerAiFeedControls = document.querySelector('#ownerAiFeedControls');
const toggleAiFeedBtn = document.querySelector('#toggleAiFeedBtn');
const participationForm = document.querySelector('#participationForm');
const participantList = document.querySelector('#participantList');
const ownerLocationPanel = document.querySelector('#ownerLocationPanel');
const dadLocationPanel = document.querySelector('#dadLocationPanel');
const startSharingBtn = document.querySelector('#startSharingBtn');
const stopSharingBtn = document.querySelector('#stopSharingBtn');
const locationStatus = document.querySelector('#locationStatus');
const dadLocationStatus = document.querySelector('#dadLocationStatus');
const dadLocationDetails = document.querySelector('#dadLocationDetails');
const state = {
  isOwner: false,
  isDad: false,
  dadConfigured: false,
  aiFeedEnabled: false,
  entries: [],
  communityPosts: [],
  participants: [],
  locationWatchId: null,
  locationPollTimer: null,
  lastLocationSentAt: 0,
};

async function refreshSession() {
  const response = await fetch('/api/session');
  if (!response.ok) throw new Error('Unable to check your sign-in status.');
  const data = await response.json();
  state.isOwner = !!data.isOwner;
  state.isDad = !!data.isDad;
  state.dadConfigured = !!data.dadConfigured;
  updateAuthUi();
}

async function refreshEntries() {
  const response = await fetch('/api/entries');
  const data = await response.json();
  state.entries = data.entries || [];
  renderEntries();
}

function updateAuthUi() {
  const loginFormVisible = !state.isOwner && !state.isDad;
  privateAccessPanel.classList.toggle('hidden', state.isDad);
  loginForm.classList.toggle('hidden', !loginFormVisible);
  entryForm.classList.toggle('hidden', !state.isOwner);
  ownerCommunityPostForm.classList.toggle('hidden', !state.isOwner);
  ownerLocationPanel.classList.toggle('hidden', !state.isOwner);
  ownerAiFeedControls.classList.toggle('hidden', !state.isOwner);
  dadLocationPanel.classList.toggle('hidden', !state.isDad);
  logoutBtn.classList.toggle('hidden', !state.isOwner && !state.isDad);
  startSharingBtn.disabled = !state.dadConfigured || state.locationWatchId !== null;

  if (state.isOwner && !state.dadConfigured) {
    locationStatus.textContent = 'Set DAD_USERNAME and DAD_PASSWORD to enable a private viewer login.';
  }

  if (state.isDad) {
    startDadLocationPolling();
  } else {
    stopDadLocationPolling();
  }

  renderCommunityPosts();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.querySelector('#username').value.trim();
  const password = document.querySelector('#password').value;

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.message || 'Login failed');
    return;
  }

  loginForm.reset();
  await refreshSession();
  await refreshEntries();
});

logoutBtn.addEventListener('click', async () => {
  if (state.locationWatchId !== null) {
    await stopLocationSharing();
  }

  const response = await fetch('/api/logout', { method: 'POST' });
  if (!response.ok) {
    alert('Unable to log out. Please try again.');
    return;
  }
  await refreshSession();
});

startSharingBtn.addEventListener('click', startLocationSharing);
stopSharingBtn.addEventListener('click', () => {
  void stopLocationSharing();
});

function startLocationSharing() {
  if (!window.isSecureContext) {
    locationStatus.textContent = 'Location sharing requires HTTPS (or localhost during development).';
    return;
  }

  if (!navigator.geolocation) {
    locationStatus.textContent = 'This browser does not support location sharing.';
    return;
  }

  if (state.locationWatchId !== null) return;

  state.lastLocationSentAt = 0;
  locationStatus.textContent = 'Waiting for your device location permission...';
  startSharingBtn.disabled = true;
  stopSharingBtn.disabled = false;
  state.locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      shareLocation(position).catch((error) => {
        state.lastLocationSentAt = 0;
        locationStatus.textContent = `Unable to send location: ${error.message}`;
      });
    },
    (error) => {
      void stopLocationSharing(`Location access failed: ${error.message}`);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

async function shareLocation(position) {
  const now = Date.now();
  if (now - state.lastLocationSentAt < 10000) return;
  state.lastLocationSentAt = now;

  const response = await fetch('/api/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Location update failed.');

  locationStatus.textContent = `Sharing is on. Last update: ${formatDate(data.updatedAt)}.`;
  startSharingBtn.disabled = true;
}

async function stopLocationSharing(message = 'Location sharing is off.') {
  if (state.locationWatchId !== null) {
    navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = null;
  }
  state.lastLocationSentAt = 0;

  startSharingBtn.disabled = false;
  stopSharingBtn.disabled = true;
  try {
    const response = await fetch('/api/location', { method: 'DELETE' });
    if (!response.ok) {
      locationStatus.textContent = 'Could not confirm sharing stopped. Any old location expires automatically.';
      return;
    }

    locationStatus.textContent = message;
  } catch {
    locationStatus.textContent = 'Could not confirm sharing stopped. Any old location expires automatically.';
  }
}

function startDadLocationPolling() {
  if (state.locationPollTimer !== null) return;

  refreshDadLocation();
  state.locationPollTimer = setInterval(refreshDadLocation, 10000);
}

function stopDadLocationPolling() {
  if (state.locationPollTimer === null) return;

  clearInterval(state.locationPollTimer);
  state.locationPollTimer = null;
}

async function refreshDadLocation() {
  try {
    const response = await fetch('/api/location');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load the shared location.');

    if (!data.active || !data.location) {
      dadLocationStatus.textContent = 'No current location is being shared.';
      dadLocationDetails.classList.add('hidden');
      dadLocationDetails.textContent = '';
      return;
    }

    dadLocationStatus.textContent = 'A live location is being shared.';
    dadLocationDetails.classList.remove('hidden');
    dadLocationDetails.textContent =
      `Latitude: ${data.location.latitude.toFixed(5)}; ` +
      `longitude: ${data.location.longitude.toFixed(5)}. ` +
      `Accuracy: about ${Math.round(data.location.accuracy)} m. ` +
      `Updated: ${formatDate(data.location.updatedAt)}.`;
  } catch (error) {
    dadLocationStatus.textContent = error.message;
    dadLocationDetails.classList.add('hidden');
  }
}

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!state.isOwner) {
    alert('Only the owner can post diary entries.');
    return;
  }

  const title = document.querySelector('#entryTitle').value.trim();
  const content = document.querySelector('#entryContent').value.trim();

  if (!title || !content) {
    alert('Please enter both a title and a diary entry.');
    return;
  }

  const response = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'Unable to create entry');
    return;
  }

  entryForm.reset();
  await refreshEntries();
});

communityPostForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  communityPostStatus.textContent = '';

  const author = document.querySelector('#communityAuthor').value.trim();
  const content = document.querySelector('#communityContent').value.trim();
  let response;
  let data;
  try {
    response = await fetch('/api/community-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content }),
    });
    data = await response.json();
  } catch (error) {
    communityPostStatus.textContent = `Unable to publish your post: ${error.message}`;
    return;
  }

  if (!response.ok) {
    communityPostStatus.textContent = data.message || 'Unable to publish your post.';
    return;
  }

  communityPostForm.reset();
  communityPostStatus.textContent = 'Your post is now public.';
  await refreshCommunityPosts();
});

ownerCommunityPostForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = document.querySelector('#ownerPostTitle').value.trim();
  const content = document.querySelector('#ownerPostContent').value.trim();
  let response;
  let data;
  try {
    response = await fetch('/api/community-posts/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    data = await response.json();
  } catch (error) {
    alert(`Unable to publish the curated post: ${error.message}`);
    return;
  }

  if (!response.ok) {
    alert(data.message || 'Unable to publish the curated post.');
    return;
  }

  ownerCommunityPostForm.reset();
  await refreshCommunityPosts();
});

communityPostList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-post]');
  if (!button || !state.isOwner) return;
  if (!window.confirm('Remove this post from the public feed?')) return;

  let response;
  let data;
  try {
    response = await fetch(`/api/community-posts/${encodeURIComponent(button.dataset.deletePost)}`, {
      method: 'DELETE',
    });
    data = await response.json();
  } catch (error) {
    alert(`Unable to remove the post: ${error.message}`);
    return;
  }
  if (!response.ok) {
    alert(data.message || 'Unable to remove the post.');
    return;
  }

  await refreshCommunityPosts();
});

toggleAiFeedBtn.addEventListener('click', async () => {
  let response;
  let data;
  try {
    response = await fetch('/api/community-posts/ai-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !state.aiFeedEnabled }),
    });
    data = await response.json();
  } catch (error) {
    alert(`Unable to update AI posting settings: ${error.message}`);
    return;
  }
  if (!response.ok) {
    alert(data.message || 'Unable to update AI posting settings.');
    return;
  }

  await refreshCommunityPosts();
});

entryList.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!form.matches('.comment-form')) return;

  event.preventDefault();
  const entryId = form.dataset.entryId;
  const author = form.querySelector('.comment-author-input').value.trim();
  const content = form.querySelector('.comment-content-input').value.trim();

  if (!author || !content) {
    alert('Comment name and content are required.');
    return;
  }

  const response = await fetch(`/api/comments/${entryId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, content }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'Unable to add comment');
    return;
  }

  form.reset();
  await refreshEntries();
});

participationForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.querySelector('#participantName').value.trim();
  const role = document.querySelector('#participantRole').value.trim();
  const message = document.querySelector('#participantMessage').value.trim();

  if (!name || !role) {
    alert('Please enter your name and how you want to participate.');
    return;
  }

  const response = await fetch('/api/participants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, role, message }),
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || 'Unable to join');
    return;
  }

  participationForm.reset();
  await refreshParticipants();
});

async function refreshParticipants() {
  const response = await fetch('/api/participants');
  const data = await response.json();
  state.participants = data.participants || [];
  renderParticipants();
}

async function refreshCommunityPosts() {
  try {
    const response = await fetch('/api/community-posts');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load the community feed.');

    state.communityPosts = data.posts || [];
    renderCommunityPosts();
    state.aiFeedEnabled = !!data.aiStatus.enabled;
    toggleAiFeedBtn.disabled = !data.aiStatus.configured;
    toggleAiFeedBtn.textContent = state.aiFeedEnabled ? 'Pause AI auto-posting' : 'Enable AI auto-posting';

    if (!data.aiStatus.configured) {
      aiFeedStatus.textContent =
        'AI research highlights are off. Set OPENAI_API_KEY to enable automatic posts; only PubMed citation metadata is sent to OpenAI.';
    } else if (!data.aiStatus.enabled) {
      aiFeedStatus.textContent = 'AI auto-posting is paused by the owner.';
    } else if (data.aiStatus.lastError) {
      aiFeedStatus.textContent =
        `${data.aiStatus.lastError} Automatic posts use PubMed citation metadata only and are limited to three per day.`;
    } else {
      aiFeedStatus.textContent =
        'AI-generated posts use PubMed citation metadata only (sent to OpenAI), link to original records, and publish automatically only when relevant research is found (up to 3 per day).';
    }
  } catch (error) {
    aiFeedStatus.textContent = error.message;
  }
}

function renderEntries() {
  if (!state.entries.length) {
    entryList.innerHTML = '<p class="empty-state">No diary entries yet. The owner can post the first one.</p>';
    return;
  }

  entryList.innerHTML = state.entries
    .map(
      (entry) => `
        <article class="entry-card">
          <div class="entry-meta">
            <div>
              <p class="entry-author">${escapeHtml(entry.author)}</p>
              <p class="entry-date">${formatDate(entry.createdAt)}</p>
            </div>
          </div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.content).replace(/\n/g, '<br>')}</p>

          <div class="comments">
            <h4>Comments</h4>
            <ul class="comment-list">
              ${
                entry.comments.length
                  ? entry.comments
                      .map(
                        (comment) => `
                          <li>
                            <div class="comment-top">
                              <span class="comment-author">${escapeHtml(comment.author)}</span>
                              <span>${formatDate(comment.createdAt)}</span>
                            </div>
                            <p>${escapeHtml(comment.content).replace(/\n/g, '<br>')}</p>
                          </li>
                        `
                      )
                      .join('')
                  : '<li><p>No comments yet.</p></li>'
              }
            </ul>

            <form class="comment-form" data-entry-id="${entry.id}">
              <input class="comment-author-input" type="text" maxlength="40" placeholder="Name you’d like us to use" required />
              <textarea class="comment-content-input" rows="2" maxlength="400" placeholder="Leave a comment..." required></textarea>
              <button type="submit">Comment</button>
            </form>
          </div>
        </article>
      `
    )
    .join('');
}

function renderCommunityPosts() {
  if (!state.communityPosts.length) {
    communityPostList.innerHTML =
      '<p class="empty-state">No community posts yet. Share a reflection or check back for a sourced research highlight.</p>';
    return;
  }

  communityPostList.innerHTML = state.communityPosts
    .map((post) => {
      const sourceUrl = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/.test(post.sourceUrl || '')
        ? post.sourceUrl
        : '';
      const kindLabel =
        post.kind === 'ai' ? 'AI-generated' : post.kind === 'owner' ? 'Owner-curated' : 'Community';
      const sourceLink = sourceUrl
        ? `<p class="community-source">Source: <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.sourceTitle || 'PubMed record')}</a>${post.sourcePublishedAt ? ` · ${escapeHtml(post.sourcePublishedAt)}` : ''}</p>`
        : '';
      const deleteButton = state.isOwner
        ? `<button class="secondary community-delete-button" type="button" data-delete-post="${escapeHtml(post.id)}">Remove</button>`
        : '';

      return `
        <article class="community-post-card">
          <div class="community-post-meta">
            <div>
              <span class="badge community-badge">${kindLabel}</span>
              <p class="entry-author">${escapeHtml(post.author)}</p>
              <p class="entry-date">${formatDate(post.createdAt)}</p>
            </div>
            ${deleteButton}
          </div>
          ${post.title ? `<h3>${escapeHtml(post.title)}</h3>` : ''}
          <p>${escapeHtml(post.content).replace(/\n/g, '<br>')}</p>
          ${sourceLink}
        </article>
      `;
    })
    .join('');
}

function renderParticipants() {
  if (!state.participants.length) {
    participantList.innerHTML = '<p class="empty-state">No one has joined yet. Be the first to take part.</p>';
    return;
  }

  participantList.innerHTML = state.participants
    .map(
      (person) => `
        <div class="participant-pill">
          <strong>${escapeHtml(person.name)}</strong>
          <div class="participant-meta">${escapeHtml(person.role)} • ${formatDate(person.createdAt)}</div>
          ${person.message ? `<p>${escapeHtml(person.message)}</p>` : ''}
        </div>
      `
    )
    .join('');
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

refreshSession();
refreshEntries();
refreshCommunityPosts();
refreshParticipants();
setInterval(refreshCommunityPosts, 30000);
