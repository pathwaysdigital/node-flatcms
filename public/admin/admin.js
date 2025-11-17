'use strict';

const READ_ONLY_FIELDS = new Set(['createdAt', 'updatedAt', 'publishedAt']);

const state = {
  schemaTypes: [],
  selectedType: null,
  items: [],
  pagination: {
    limit: 20,
    offset: 0,
    total: 0
  },
  credentials: {
    baseUrl: window.location.origin,
    apiKey: ''
  },
  currentItem: null,
  searchDebounce: null,
  editingCredentials: false,
  richtextEditors: {}
};

function $(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

const elements = {
  apiKeyInput: $('#api-key-input'),
  baseUrlInput: $('#base-url-input'),
  saveCredentialsButton: $('#save-credentials-button'),
  testConnectionButton: $('#test-connection-button'),
  authStatusText: $('#auth-status-text'),
  contentTypeSelect: $('#content-type-select'),
  searchInput: $('#search-input'),
  statusFilter: $('#status-filter'),
  refreshListButton: $('#refresh-list-button'),
  newEntryButton: $('#new-entry-button'),
  contentList: $('#content-list'),
  paginationInfo: $('#pagination-info'),
  prevPageButton: $('#prev-page-button'),
  nextPageButton: $('#next-page-button'),
  editorTitle: $('#editor-title'),
  contentForm: $('#content-form'),
  dynamicFields: $('#dynamic-fields'),
  saveEntryButton: $('#save-entry-button'),
  deleteEntryButton: $('#delete-entry-button'),
  fieldId: $('#field-id'),
  fieldStatus: $('#field-status'),
  fieldCreatedAt: $('#field-createdAt'),
  fieldUpdatedAt: $('#field-updatedAt'),
  adminMain: $('#admin-main'),
  credentialsPanel: $('#credentials-panel'),
  credentialsBody: $('#credentials-body'),
  credentialsSummary: $('#credentials-summary'),
  editCredentialsButton: $('#edit-credentials-button'),
  editorDialog: $('#editor-dialog'),
  closeDialogButton: $('#close-dialog-button')
};

function showToast(message, variant = 'success', timeout = 4000) {
  const container = document.querySelector('#notifications');
  const toast = document.createElement('div');
  toast.className = `toast ${variant}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, timeout);
}

function loadCredentials() {
  const stored = localStorage.getItem('flatcms-admin-credentials');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.credentials = {
        baseUrl: parsed.baseUrl || window.location.origin,
        apiKey: parsed.apiKey || ''
      };
    } catch (error) {
      console.warn('Failed to parse stored credentials', error);
    }
  }

  elements.apiKeyInput.value = state.credentials.apiKey;
  elements.baseUrlInput.value = state.credentials.baseUrl;
  state.editingCredentials = !state.credentials.apiKey;
  updateVisibility();
}

function saveCredentials() {
  state.credentials.apiKey = elements.apiKeyInput.value.trim();
  state.credentials.baseUrl = elements.baseUrlInput.value.trim() || window.location.origin;
  localStorage.setItem('flatcms-admin-credentials', JSON.stringify(state.credentials));
  const hasApiKey = Boolean(state.credentials.apiKey);
  if (!hasApiKey) {
    state.editingCredentials = true;
    updateVisibility();
    showToast('Enter an API key to unlock the admin.', 'error');
    return;
  }
  elements.authStatusText.textContent = 'Credentials saved locally.';
  showToast('Credentials saved');
  state.editingCredentials = false;
  updateVisibility();
  loadSchema();
}

function updateVisibility() {
  const hasApiKey = Boolean(state.credentials.apiKey);
  elements.adminMain.classList.toggle('hidden', !hasApiKey);
  elements.credentialsPanel.classList.toggle('collapsed', hasApiKey && !state.editingCredentials);
  elements.credentialsBody.classList.toggle('hidden', hasApiKey && !state.editingCredentials);
  elements.credentialsSummary.classList.toggle('hidden', !(hasApiKey && !state.editingCredentials));
}

async function fetchJson(path, options = {}) {
  const baseUrl = state.credentials.baseUrl || window.location.origin;
  const url = new URL(path, baseUrl);
  const skipAuth = options.skipAuth === true;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  if (!skipAuth) {
    const apiKey = state.credentials.apiKey.trim();
    if (!apiKey) {
      throw new Error('Missing API key. Save it under API Access.');
    }
    headers.Authorization = headers.Authorization || `Bearer ${apiKey}`;
  } else if (headers.Authorization === undefined) {
    delete headers.Authorization;
  }

  let body = options.body;
  if (body && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const err = new Error(errorPayload.error || response.statusText);
    err.details = errorPayload.details;
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadSchema() {
  if (!state.credentials.apiKey) {
    return;
  }
  try {
    const data = await fetchJson('/api/schema');
    state.schemaTypes = data.types || [];
    renderTypeOptions();

    if (state.schemaTypes.length === 0) {
      elements.dynamicFields.innerHTML = '<p>No content types defined in schema.</p>';
      elements.contentList.innerHTML = '<li>Schema definitions are empty.</li>';
      return;
    }

    const nextType = state.schemaTypes.find(type => type.name === state.selectedType)?.name || state.schemaTypes[0].name;
    selectType(nextType);
  } catch (error) {
    console.error('Failed to load schema', error);
    showToast(`Schema load failed: ${error.message}`, 'error', 6000);
  }
}

function renderTypeOptions() {
  elements.contentTypeSelect.innerHTML = '';
  state.schemaTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type.name;
    option.textContent = type.title || type.name;
    elements.contentTypeSelect.appendChild(option);
  });
}

function getCurrentTypeDefinition() {
  return state.schemaTypes.find(t => t.name === state.selectedType) || null;
}

function selectType(typeName) {
  state.selectedType = typeName;
  elements.contentTypeSelect.value = typeName;
  state.pagination.offset = 0;
  state.currentItem = null;
  renderDynamicFields();
  renderEditor(null);
  loadContentList();
}

function ensureEditorDialogOpen() {
  if (!elements.editorDialog.open) {
    elements.editorDialog.showModal();
  }
}

function closeEditorDialog() {
  if (elements.editorDialog.open) {
    elements.editorDialog.close();
  }
}

function renderDynamicFields() {
  const type = getCurrentTypeDefinition();
  if (!type) {
    elements.dynamicFields.innerHTML = '<p>No schema found for this type.</p>';
    return;
  }

  state.richtextEditors = {};
  const container = document.createElement('div');
  for (const [fieldName, schema] of Object.entries(type.properties || {})) {
    if (['id', 'createdAt', 'updatedAt', 'status', 'publishedAt'].includes(fieldName)) {
      continue;
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.field = fieldName;

    const label = document.createElement('label');
    label.textContent = `${fieldName}${(type.required || []).includes(fieldName) ? ' *' : ''}`;

    if (schema.description) {
      const hint = document.createElement('small');
      hint.textContent = schema.description;
      label.appendChild(hint);
    }

    let input;
    if (schema.type === 'richtext') {
      input = createRichtextField(fieldName);
    } else {
      input = createInputForSchema(fieldName, schema);
      if ((type.required || []).includes(fieldName)) {
        input.required = true;
      }
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }

  elements.dynamicFields.innerHTML = '';
  elements.dynamicFields.appendChild(container);
}

function createRichtextField(fieldName) {
  const fieldId = `richtext-${fieldName}`;
  const container = document.createElement('div');
  container.className = 'richtext-field';

  const toolbar = document.createElement('div');
  toolbar.className = 'richtext-toolbar';

  const buttons = [
    { command: 'bold', label: 'B' },
    { command: 'italic', label: 'I' },
    { command: 'underline', label: 'U' },
    { command: 'insertUnorderedList', label: '• List' },
    { command: 'insertOrderedList', label: '1. List' }
  ];

  buttons.forEach(({ command, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.command = command;
    button.textContent = label;
    button.ariaPressed = 'false';
    toolbar.appendChild(button);
  });

  const editor = document.createElement('div');
  editor.className = 'richtext-editor';
  editor.contentEditable = 'true';
  editor.id = fieldId;
  editor.dataset.fieldName = fieldName;

  const hiddenInput = document.createElement('textarea');
  hiddenInput.name = fieldName;
  hiddenInput.className = 'richtext-hidden-input';
  hiddenInput.hidden = true;

  editor.addEventListener('input', () => {
    hiddenInput.value = editor.innerHTML.trim();
  });

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button[data-command]');
    if (!button) {
      return;
    }
    event.preventDefault();
    editor.focus();
    document.execCommand(button.dataset.command, false);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    updateToolbarState();
  });

  function updateToolbarState() {
    buttons.forEach(({ command }, index) => {
      const button = toolbar.children[index];
      if (!button) return;
      const active = document.queryCommandState(command);
      button.classList.toggle('active', !!active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('focus', updateToolbarState);
  updateToolbarState();

  container.appendChild(toolbar);
  container.appendChild(editor);
  container.appendChild(hiddenInput);

  state.richtextEditors[fieldName] = { editor, hiddenInput, updateToolbarState };
  return container;
}

function getRichtextValue(fieldName) {
  const richtext = state.richtextEditors[fieldName];
  if (!richtext) return '';
  const html = richtext.editor.innerHTML.trim();
  const textContent = richtext.editor.textContent.replace(/\u00A0/g, '').trim();
  const hasMedia = /<(img|video|iframe|embed|object)/i.test(html);
  if (!textContent && !hasMedia) {
    return '';
  }
  return html;
}

function createInputForSchema(fieldName, schema) {
  const fieldId = `field-${fieldName}`;
  let inputElement;

  if (schema.enum) {
    inputElement = document.createElement('select');
    schema.enum.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      inputElement.appendChild(option);
    });
  } else if (schema.type === 'boolean') {
    inputElement = document.createElement('select');
    ['true', 'false'].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      inputElement.appendChild(option);
    });
  } else if (schema.type === 'array') {
    inputElement = document.createElement('textarea');
    inputElement.placeholder = 'Comma separated values';
    inputElement.rows = 2;
  } else if (schema.type === 'number' || schema.type === 'integer') {
    inputElement = document.createElement('input');
    inputElement.type = 'number';
  } else if (schema.format === 'date-time') {
    inputElement = document.createElement('input');
    inputElement.type = 'datetime-local';
  } else if (schema.format === 'date') {
    inputElement = document.createElement('input');
    inputElement.type = 'date';
  } else if (schema.maxLength && schema.maxLength < 120) {
    inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.maxLength = schema.maxLength;
  } else {
    inputElement = document.createElement('textarea');
    inputElement.rows = 4;
  }

  inputElement.id = fieldId;
  inputElement.name = fieldName;
  inputElement.dataset.type = schema.type || 'string';
  return inputElement;
}

async function loadContentList() {
  if (!state.selectedType) return;

  const params = new URLSearchParams();
  params.set('limit', state.pagination.limit);
  params.set('offset', state.pagination.offset);

  const searchTerm = elements.searchInput.value.trim();
  if (searchTerm) params.set('search', searchTerm);
  const status = elements.statusFilter.value;
  if (status) params.set('status', status);

  try {
    const data = await fetchJson(`/api/content/${state.selectedType}?${params.toString()}`);
    state.items = data.data || [];
    state.pagination.total = data.pagination?.total ?? state.items.length;
    renderContentList();
    updatePaginationControls();
  } catch (error) {
    console.error('Failed to load content list', error);
    showToast(`List load failed: ${error.message}`, 'error');
  }
}

function renderContentList() {
  elements.contentList.innerHTML = '';
  if (state.items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No entries found.';
    elements.contentList.appendChild(empty);
    elements.paginationInfo.textContent = '0 items';
    return;
  }

  state.items.forEach(item => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.dataset.id = item.id;
    li.classList.toggle('contrast', state.currentItem?.id === item.id);
    const label = item.title || item.slug || item.name || item.id;
    const status = item.status || 'draft';
    const updated = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '';
    li.innerHTML = `<strong>${label}</strong><br /><small>${status} · ${updated}</small>`;
    li.addEventListener('click', () => loadItemDetails(item.id));
    elements.contentList.appendChild(li);
  });

  const start = state.pagination.offset + 1;
  const end = state.pagination.offset + state.items.length;
  elements.paginationInfo.textContent = `${start}–${end} of ${state.pagination.total}`;
}

function updatePaginationControls() {
  const { offset, limit, total } = state.pagination;
  elements.prevPageButton.disabled = offset === 0;
  elements.nextPageButton.disabled = offset + limit >= total;
}

async function loadItemDetails(id) {
  if (!state.selectedType) return;
  try {
    const item = await fetchJson(`/api/content/${state.selectedType}/${id}`);
    state.currentItem = item;
    renderEditor(item);
    highlightSelectedItem(id);
    ensureEditorDialogOpen();
  } catch (error) {
    console.error('Failed to load entry', error);
    showToast(`Failed to load entry: ${error.message}`, 'error');
  }
}

function highlightSelectedItem(id) {
  elements.contentList.querySelectorAll('li').forEach(li => {
    li.classList.toggle('contrast', li.dataset.id === id);
  });
}

function renderEditor(item) {
  elements.contentForm.reset();
  elements.editorTitle.textContent = item ? 'Edit entry' : 'Create entry';
  elements.deleteEntryButton.disabled = !item;
  elements.fieldId.value = item?.id || '';
  elements.fieldStatus.value = item?.status || 'draft';
  elements.fieldCreatedAt.value = item?.createdAt || '';
  elements.fieldUpdatedAt.value = item?.updatedAt || '';

  const type = getCurrentTypeDefinition();
  if (!type) return;

  for (const [fieldName] of Object.entries(type.properties || {})) {
    if (['id', 'status', 'createdAt', 'updatedAt', 'publishedAt'].includes(fieldName)) {
      continue;
    }
    const field = elements.contentForm.querySelector(`[name="${fieldName}"]`);
    const schema = type.properties?.[fieldName];
    const value = item?.[fieldName];

    if (schema?.type === 'richtext') {
      const richtext = state.richtextEditors[fieldName];
      if (richtext) {
        richtext.editor.innerHTML = value || '';
        richtext.hiddenInput.value = value || '';
        if (typeof richtext.updateToolbarState === 'function') {
          richtext.updateToolbarState();
        }
      }
      continue;
    }

    if (!field) continue;
    if (Array.isArray(value)) {
      field.value = value.join(', ');
    } else if (value === undefined || value === null) {
      field.value = '';
    } else if (typeof value === 'object') {
      field.value = JSON.stringify(value, null, 2);
    } else {
      field.value = value;
    }
  }
}

function collectFormData() {
  const type = getCurrentTypeDefinition();
  if (!type) return {};

  const formData = new FormData(elements.contentForm);
  const payload = {};

  for (const [name, valueRaw] of formData.entries()) {
    const value = valueRaw.trim();
    if (name === 'id' && !value) {
      continue;
    }
    if (READ_ONLY_FIELDS.has(name) || name === '') {
      continue;
    }
    if (name === 'status') {
      payload.status = value || 'draft';
      continue;
    }

    const schema = type.properties?.[name];
    if (schema?.type === 'richtext') {
      payload[name] = getRichtextValue(name);
      continue;
    }

    if (!value) {
      continue;
    }

    payload[name] = coerceValue(value, schema);
  }

  return payload;
}

function coerceValue(value, schema = {}) {
  if (!schema || !schema.type) return value;

  switch (schema.type) {
    case 'number':
    case 'integer':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === '1' || value === 'on';
    case 'array':
      if (Array.isArray(value)) return value;
      return value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    case 'object':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!state.selectedType) {
    showToast('Select a content type first.', 'error');
    return;
  }

  const payload = collectFormData();
  if (!payload || Object.keys(payload).length === 0) {
    showToast('Nothing to save. Fill in some fields.', 'error');
    return;
  }

  const isUpdate = Boolean(state.currentItem?.id);
  const endpoint = isUpdate
    ? `/api/content/${state.selectedType}/${state.currentItem.id}`
    : `/api/content/${state.selectedType}`;
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const result = await fetchJson(endpoint, {
      method,
      body: payload
    });
    state.currentItem = result;
    showToast(`Entry ${isUpdate ? 'updated' : 'created'} successfully`);
    renderEditor(result);
    await loadContentList();
    highlightSelectedItem(result.id);
    closeEditorDialog();
  } catch (error) {
    console.error('Failed to save entry', error);
    const details = Array.isArray(error.details)
      ? error.details.map(detail => detail.message || JSON.stringify(detail)).join('\n')
      : null;
    showToast(`Save failed: ${error.message}${details ? `\n${details}` : ''}`, 'error', 6000);
  }
}

async function handleDelete() {
  if (!state.currentItem?.id) return;
  const confirmed = window.confirm('Delete this entry? This cannot be undone.');
  if (!confirmed) return;

  try {
    await fetchJson(`/api/content/${state.selectedType}/${state.currentItem.id}`, {
      method: 'DELETE'
    });
    showToast('Entry deleted');
    state.currentItem = null;
    renderEditor(null);
    await loadContentList();
    highlightSelectedItem(null);
    closeEditorDialog();
  } catch (error) {
    console.error('Failed to delete entry', error);
    showToast(`Delete failed: ${error.message}`, 'error');
  }
}

function handleSearchInput() {
  clearTimeout(state.searchDebounce);
  state.searchDebounce = setTimeout(() => {
    state.pagination.offset = 0;
    loadContentList();
  }, 350);
}

function handleStatusFilterChange() {
  state.pagination.offset = 0;
  loadContentList();
}

function handlePrevPage() {
  if (state.pagination.offset === 0) return;
  state.pagination.offset = Math.max(0, state.pagination.offset - state.pagination.limit);
  loadContentList();
}

function handleNextPage() {
  const { offset, limit, total } = state.pagination;
  if (offset + limit >= total) return;
  state.pagination.offset += limit;
  loadContentList();
}

function registerEventListeners() {
  elements.saveCredentialsButton.addEventListener('click', saveCredentials);
  elements.editCredentialsButton.addEventListener('click', () => {
    state.editingCredentials = true;
    updateVisibility();
  });
  elements.closeDialogButton.addEventListener('click', () => {
    closeEditorDialog();
  });
  elements.testConnectionButton.addEventListener('click', async () => {
    const baseUrl = elements.baseUrlInput.value.trim() || window.location.origin;
    try {
      const url = new URL('/health', baseUrl);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      showToast(`Health: ${payload.status || 'ok'}`);
    } catch (error) {
      showToast(`Health check failed: ${error.message}`, 'error');
    }
  });

  elements.contentTypeSelect.addEventListener('change', event => {
    selectType(event.target.value);
  });

  elements.refreshListButton.addEventListener('click', () => {
    state.pagination.offset = 0;
    loadContentList();
  });

  elements.newEntryButton.addEventListener('click', () => {
    state.currentItem = null;
    renderEditor(null);
    highlightSelectedItem(null);
    ensureEditorDialogOpen();
  });

  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.statusFilter.addEventListener('change', handleStatusFilterChange);
  elements.prevPageButton.addEventListener('click', handlePrevPage);
  elements.nextPageButton.addEventListener('click', handleNextPage);

  elements.contentForm.addEventListener('submit', handleFormSubmit);
  elements.deleteEntryButton.addEventListener('click', handleDelete);
}

function init() {
  loadCredentials();
  registerEventListeners();
  updateVisibility();
  if (state.credentials.apiKey) {
    loadSchema();
  }
}

document.addEventListener('DOMContentLoaded', init);


