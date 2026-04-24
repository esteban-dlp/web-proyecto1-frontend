/* ═══════════════════════════════════════════════════════════════════════════
   Series Tracker — Frontend Application
   Uses native fetch() to consume the backend REST API.
   API_BASE_URL is defined in config.js and loaded before this script.
═══════════════════════════════════════════════════════════════════════════ */

// ─── Application State ─────────────────────────────────────────────────────
const state = {
  page: 1,
  limit: 15,
  q: '',
  status: '',
  genre: '',
  sort: 'created_at',
  order: 'desc',
  editingId: null,
  searchTimer: null,
  genreTimer: null,
};

// ─── DOM Element Cache ──────────────────────────────────────────────────────
let el = {};

// ─── Init ───────────────────────────────────────────────────────────────────
function init() {
  el = {
    toggleFormBtn:  document.getElementById('btn-toggle-form'),
    formPanel:      document.getElementById('form-panel'),
    formTitle:      document.getElementById('form-title'),
    seriesForm:     document.getElementById('series-form'),
    btnSubmit:      document.getElementById('btn-submit'),
    btnCloseForm:   document.getElementById('btn-close-form'),
    btnCancelEdit:  document.getElementById('btn-cancel-edit'),
    formError:      document.getElementById('form-error'),

    fieldTitle:       document.getElementById('field-title'),
    fieldGenre:       document.getElementById('field-genre'),
    fieldStatus:      document.getElementById('field-status'),
    fieldRating:      document.getElementById('field-rating'),
    fieldReleaseYear: document.getElementById('field-release-year'),
    fieldImageUrl:    document.getElementById('field-image-url'),
    fieldDescription: document.getElementById('field-description'),

    searchInput:    document.getElementById('search-input'),
    filterStatus:   document.getElementById('filter-status'),
    filterGenre:    document.getElementById('filter-genre'),
    sortSelect:     document.getElementById('sort-select'),

    statusMessage:  document.getElementById('status-message'),
    seriesGrid:     document.getElementById('series-grid'),
    pagination:     document.getElementById('pagination'),
    toastContainer: document.getElementById('toast-container'),
  };

  setupEventListeners();
  fetchSeries();
}

// ─── Event Listeners ────────────────────────────────────────────────────────
function setupEventListeners() {
  // Open / close form panel
  el.toggleFormBtn.addEventListener('click', () => {
    if (state.editingId) exitEditMode();
    const isOpen = !el.formPanel.classList.contains('hidden');
    if (isOpen) {
      closeFormPanel();
    } else {
      openFormPanel();
    }
  });

  el.btnCloseForm.addEventListener('click', () => {
    closeFormPanel();
    if (state.editingId) exitEditMode();
  });

  el.btnCancelEdit.addEventListener('click', () => {
    exitEditMode();
    closeFormPanel();
  });

  // Form submit
  el.seriesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getFormData();
    if (state.editingId) {
      await updateSeries(state.editingId, data);
    } else {
      await createSeries(data);
    }
  });

  // Search (debounced)
  el.searchInput.addEventListener('input', (e) => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.page = 1;
      fetchSeries();
    }, 420);
  });

  // Status filter
  el.filterStatus.addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    fetchSeries();
  });

  // Genre filter (debounced)
  el.filterGenre.addEventListener('input', (e) => {
    clearTimeout(state.genreTimer);
    state.genreTimer = setTimeout(() => {
      state.genre = e.target.value.trim();
      state.page = 1;
      fetchSeries();
    }, 420);
  });

  // Sort
  el.sortSelect.addEventListener('change', (e) => {
    const [sort, order] = e.target.value.split('|');
    state.sort = sort;
    state.order = order;
    state.page = 1;
    fetchSeries();
  });
}

function openFormPanel() {
  el.formPanel.classList.remove('hidden');
  el.toggleFormBtn.textContent = '✕ Close';
  el.toggleFormBtn.setAttribute('aria-expanded', 'true');
  el.fieldTitle.focus();
}

function closeFormPanel() {
  el.formPanel.classList.add('hidden');
  el.toggleFormBtn.textContent = '+ Add Series';
  el.toggleFormBtn.setAttribute('aria-expanded', 'false');
}

// ─── API: Fetch list ────────────────────────────────────────────────────────
async function fetchSeries() {
  showLoading();

  try {
    const params = new URLSearchParams({
      page:  state.page,
      limit: state.limit,
      sort:  state.sort,
      order: state.order,
    });
    if (state.q)      params.append('q',      state.q);
    if (state.status) params.append('status', state.status);
    if (state.genre)  params.append('genre',  state.genre);

    const res = await fetch(`${API_BASE_URL}/series?${params}`);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);

    const json = await res.json();
    renderSeries(json.data);
    renderPagination(json.pagination);
  } catch (err) {
    showError(`Could not load series. ${err.message || 'Check your connection.'}`);
  }
}

// ─── API: Create ────────────────────────────────────────────────────────────
async function createSeries(data) {
  clearFormError();
  setSubmitLoading(true, 'Adding...');

  try {
    const res = await fetch(`${API_BASE_URL}/series`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      showFormError(json.details || [json.error || 'Failed to create series.']);
      return;
    }

    resetForm();
    closeFormPanel();
    showToast(`"${json.title}" added successfully!`, 'success');
    state.page = 1;
    await fetchSeries();
  } catch (err) {
    showFormError(['Network error. Could not reach the API.']);
  } finally {
    setSubmitLoading(false, 'Add Series');
  }
}

// ─── API: Update ────────────────────────────────────────────────────────────
async function updateSeries(id, data) {
  clearFormError();
  setSubmitLoading(true, 'Updating...');

  try {
    const res = await fetch(`${API_BASE_URL}/series/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      showFormError(json.details || [json.error || 'Failed to update series.']);
      return;
    }

    exitEditMode();
    closeFormPanel();
    showToast(`"${json.title}" updated successfully!`, 'success');
    await fetchSeries();
  } catch (err) {
    showFormError(['Network error. Could not reach the API.']);
  } finally {
    // state.editingId may be null here if update succeeded
    setSubmitLoading(false, state.editingId ? 'Update Series' : 'Add Series');
  }
}

// ─── API: Delete ────────────────────────────────────────────────────────────
async function deleteSeries(id, title) {
  if (!confirm(`Delete "${title}"?\nThis action cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/series/${id}`, { method: 'DELETE' });

    if (res.status === 204) {
      showToast(`"${title}" deleted.`, 'success');
      await fetchSeries();
      return;
    }

    const json = await res.json();
    showToast(json.error || 'Failed to delete series.', 'error');
  } catch (err) {
    showToast('Network error. Could not delete the series.', 'error');
  }
}

// ─── Edit Mode ──────────────────────────────────────────────────────────────
async function handleEdit(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/series/${id}`);
    if (!res.ok) throw new Error('Not found');
    const series = await res.json();
    enterEditMode(series);
  } catch {
    showToast('Could not load series data for editing.', 'error');
  }
}

function enterEditMode(series) {
  state.editingId = series.id;

  el.formTitle.textContent = 'Edit Series';
  el.btnSubmit.textContent = 'Update Series';
  el.btnCancelEdit.classList.remove('hidden');

  el.fieldTitle.value       = series.title        ?? '';
  el.fieldGenre.value       = series.genre        ?? '';
  el.fieldStatus.value      = series.status       ?? '';
  el.fieldRating.value      = series.rating       !== null && series.rating !== undefined ? series.rating : '';
  el.fieldReleaseYear.value = series.release_year ?? '';
  el.fieldImageUrl.value    = series.image_url    ?? '';
  el.fieldDescription.value = series.description  ?? '';

  clearFormError();
  openFormPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
  state.editingId = null;
  el.formTitle.textContent = 'Add New Series';
  el.btnSubmit.textContent = 'Add Series';
  el.btnCancelEdit.classList.add('hidden');
  resetForm();
}

// ─── Render: Grid ────────────────────────────────────────────────────────────
function renderSeries(series) {
  el.seriesGrid.innerHTML = '';
  hideStatusMessage();

  if (!series || series.length === 0) {
    showEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();
  series.forEach((s) => fragment.appendChild(buildCard(s)));
  el.seriesGrid.appendChild(fragment);
}

function buildCard(series) {
  const card = document.createElement('article');
  card.className = 'series-card';

  // ── Image wrapper ──────────────────────────────────────────────────────────
  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-image-wrapper';

  if (series.image_url) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.src       = series.image_url;
    img.alt       = series.title;
    img.loading   = 'lazy';
    img.addEventListener('error', () => {
      imgWrap.removeChild(img);
      imgWrap.insertBefore(buildPlaceholder(), imgWrap.firstChild);
    });
    imgWrap.appendChild(img);
  } else {
    imgWrap.appendChild(buildPlaceholder());
  }

  const badge = document.createElement('span');
  badge.className = `card-badge status-${series.status}`;
  badge.textContent = capitalize(series.status);
  imgWrap.appendChild(badge);

  // ── Card body ──────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'card-body';

  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = series.title;

  if (series.release_year) {
    const yearSpan = document.createElement('span');
    yearSpan.className = 'card-year';
    yearSpan.textContent = ` (${series.release_year})`;
    titleEl.appendChild(yearSpan);
  }

  const genreEl = document.createElement('p');
  genreEl.className = 'card-genre';
  genreEl.textContent = series.genre;

  const ratingEl = document.createElement('p');
  ratingEl.className = 'card-rating';
  ratingEl.textContent = series.rating !== null && series.rating !== undefined
    ? `⭐ ${parseFloat(series.rating).toFixed(1)}`
    : 'Not rated';

  body.appendChild(titleEl);
  body.appendChild(genreEl);
  body.appendChild(ratingEl);

  if (series.description) {
    const descEl = document.createElement('p');
    descEl.className = 'card-description';
    descEl.textContent = series.description;
    body.appendChild(descEl);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-sm btn-edit';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => handleEdit(series.id));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-sm btn-delete';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteSeries(series.id, series.title));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  body.appendChild(actions);

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function buildPlaceholder() {
  const ph = document.createElement('div');
  ph.className = 'card-image-placeholder';
  ph.innerHTML = '📺<small>No Image</small>';
  return ph;
}

// ─── Render: Pagination ──────────────────────────────────────────────────────
function renderPagination(pagination) {
  el.pagination.innerHTML = '';
  if (!pagination || pagination.totalPages <= 1) return;

  const { page, totalPages } = pagination;

  const nav = document.createElement('div');
  nav.className = 'pagination-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-sm btn-pagination';
  prevBtn.textContent = '← Prev';
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener('click', () => {
    state.page = page - 1;
    fetchSeries();
    scrollToTop();
  });

  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = `Page ${page} of ${totalPages}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-sm btn-pagination';
  nextBtn.textContent = 'Next →';
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener('click', () => {
    state.page = page + 1;
    fetchSeries();
    scrollToTop();
  });

  nav.appendChild(prevBtn);
  nav.appendChild(info);
  nav.appendChild(nextBtn);
  el.pagination.appendChild(nav);
}

// ─── UI State Helpers ────────────────────────────────────────────────────────
function showLoading() {
  el.seriesGrid.innerHTML = '';
  el.pagination.innerHTML = '';
  el.statusMessage.className = 'status-message';
  el.statusMessage.innerHTML = `
    <div class="spinner-wrapper">
      <div class="spinner"></div>
      <p>Loading series...</p>
    </div>`;
}

function showError(message) {
  el.seriesGrid.innerHTML = '';
  el.pagination.innerHTML = '';
  el.statusMessage.className = 'status-message error';
  el.statusMessage.innerHTML = `<p>⚠ ${message}</p>`;
}

function showEmptyState() {
  el.statusMessage.className = 'status-message';
  el.statusMessage.innerHTML = `
    <div class="empty-state">
      <p class="empty-icon">📺</p>
      <p class="empty-title">No series found</p>
      <p class="empty-subtitle">Adjust your filters or add your first series!</p>
    </div>`;
}

function hideStatusMessage() {
  el.statusMessage.className = 'status-message hidden';
  el.statusMessage.innerHTML = '';
}

function showFormError(errors) {
  const msgs = Array.isArray(errors) ? errors : [errors];
  el.formError.innerHTML = msgs.map((m) => `<div>• ${m}</div>`).join('');
  el.formError.classList.remove('hidden');
}

function clearFormError() {
  el.formError.innerHTML = '';
  el.formError.classList.add('hidden');
}

function setSubmitLoading(loading, label) {
  el.btnSubmit.disabled = loading;
  el.btnSubmit.textContent = label;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}

// ─── Form Helpers ────────────────────────────────────────────────────────────
function getFormData() {
  const data = {
    title:  el.fieldTitle.value.trim(),
    genre:  el.fieldGenre.value.trim(),
    status: el.fieldStatus.value,
  };

  const description = el.fieldDescription.value.trim();
  if (description) data.description = description;

  const rating = el.fieldRating.value;
  if (rating !== '') data.rating = parseFloat(rating);

  const releaseYear = el.fieldReleaseYear.value;
  if (releaseYear !== '') data.release_year = parseInt(releaseYear, 10);

  const imageUrl = el.fieldImageUrl.value.trim();
  if (imageUrl) data.image_url = imageUrl;

  return data;
}

function resetForm() {
  el.seriesForm.reset();
  clearFormError();
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
