// =========================================================
// ADMIN MENU MANAGEMENT — full CRUD on the meals table.
// Image upload to Supabase Storage. Audit-log on every change.
// =========================================================

import { adminProfile } from './admin-shared.js'; // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

let meals = [];
let filtered = [];
let editing = null; // current meal being edited (null = create mode)

// ---------- DOM REFS ----------

const els = {
  search:        document.getElementById('search-input'),
  categoryFilter:document.getElementById('category-filter'),
  statusFilter:  document.getElementById('status-filter'),
  addBtn:        document.getElementById('add-meal-btn'),
  bulkActive:    document.getElementById('bulk-activate-btn'),
  bulkClearNew:  document.getElementById('bulk-clear-new-btn'),
  tbody:         document.getElementById('meals-tbody'),
  footerCount:   document.getElementById('meals-count'),
  modal:         document.getElementById('meal-modal'),
  modalTitle:    document.getElementById('meal-modal-title'),
  modalClose:    document.getElementById('meal-modal-close'),
  modalCancel:   document.getElementById('meal-modal-cancel'),
  modalDelete:   document.getElementById('meal-modal-delete'),
  modalSave:     document.getElementById('meal-modal-save'),
  form:          document.getElementById('meal-form'),
  imgPreview:    document.getElementById('image-preview'),
  imgFileInput:  document.getElementById('image-file'),
  imgUrlInput:   document.getElementById('image-url')
};

// ---------- LOAD ----------

async function loadMeals() {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    toast('Could not load meals.', 'error');
    return;
  }
  meals = data || [];
  applyFilters();
}

// ---------- FILTERS ----------

function applyFilters() {
  const search = (els.search?.value || '').toLowerCase().trim();
  const category = els.categoryFilter?.value || '';
  const status = els.statusFilter?.value || '';

  filtered = meals.filter((m) => {
    if (search) {
      const hay = `${m.name} ${m.slug} ${m.tagline || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (category && m.category !== category) return false;
    if (status === 'active'   && !m.is_active) return false;
    if (status === 'inactive' &&  m.is_active) return false;
    if (status === 'new'      && !m.new_this_week) return false;
    return true;
  });
  renderTable();
}

// ---------- RENDER ----------

function renderTable() {
  if (!els.tbody) return;
  if (filtered.length === 0) {
    els.tbody.innerHTML = `
      <tr><td colspan="8" class="admin-table__empty">No meals match these filters.</td></tr>
    `;
    if (els.footerCount) els.footerCount.textContent = '';
    return;
  }
  els.tbody.innerHTML = filtered.map(rowHtml).join('');
  if (els.footerCount) {
    els.footerCount.textContent =
      `Showing ${filtered.length} of ${meals.length} meal${meals.length === 1 ? '' : 's'}`;
  }
  wireRowActions();
}

function rowHtml(meal) {
  const img = meal.image_url
    ? `<img class="admin-table__thumb" src="${escapeHtml(meal.image_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-table__thumb admin-table__thumb--placeholder',textContent:'No img'}))" />`
    : `<div class="admin-table__thumb admin-table__thumb--placeholder">No img</div>`;

  return `
    <tr data-id="${escapeHtml(meal.id)}">
      <td>${img}</td>
      <td class="admin-table__name-cell">
        <p class="admin-table__name">${escapeHtml(meal.name)}</p>
        <p class="admin-table__slug">${escapeHtml(meal.slug)}</p>
      </td>
      <td>${escapeHtml(meal.category)}</td>
      <td>${meal.kcal ?? '—'}</td>
      <td>£${parseFloat(meal.price_single ?? 0).toFixed(2)}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" data-toggle="is_active" ${meal.is_active ? 'checked' : ''} />
          <span class="toggle__slider"></span>
        </label>
      </td>
      <td>
        <label class="toggle">
          <input type="checkbox" data-toggle="new_this_week" ${meal.new_this_week ? 'checked' : ''} />
          <span class="toggle__slider"></span>
        </label>
      </td>
      <td class="admin-table__actions">
        <button class="btn btn--outline" data-edit="${escapeHtml(meal.id)}">Edit</button>
      </td>
    </tr>
  `;
}

function wireRowActions() {
  els.tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.edit));
  });
  els.tbody.querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.closest('tr').dataset.id;
      toggleField(id, cb.dataset.toggle, cb.checked, cb);
    });
  });
}

// ---------- TOGGLES (inline) ----------

async function toggleField(id, field, newValue, checkbox) {
  const meal = meals.find((m) => m.id === id);
  if (!meal) return;
  const oldValue = meal[field];

  checkbox.disabled = true;
  const { error } = await supabase.from('meals')
    .update({ [field]: newValue })
    .eq('id', id);

  checkbox.disabled = false;

  if (error) {
    toast(error.message || 'Could not update.', 'error');
    checkbox.checked = oldValue;
    return;
  }

  meal[field] = newValue;
  writeAudit(`toggled_${field}`, id, { [field]: oldValue }, { [field]: newValue });
  toast(`${humanFieldLabel(field)} ${newValue ? 'on' : 'off'} for "${meal.name}".`, 'success');
}

function humanFieldLabel(f) {
  return f === 'is_active' ? 'Active' : f === 'new_this_week' ? 'New this week' : f;
}

// ---------- BULK ACTIONS ----------

async function bulkSetActive() {
  const toUpdate = meals.filter((m) => !m.is_active);
  if (toUpdate.length === 0) {
    toast('Everything is already active.', 'info');
    return;
  }
  if (!confirm(`Set all ${toUpdate.length} inactive meal(s) to active?`)) return;

  const ids = toUpdate.map((m) => m.id);
  const { error } = await supabase.from('meals').update({ is_active: true }).in('id', ids);
  if (error) { toast(error.message, 'error'); return; }
  writeAudit('bulk_activate', null, null, { count: ids.length, ids });
  toast(`Activated ${ids.length} meals.`, 'success');
  await loadMeals();
}

async function bulkClearNew() {
  const toUpdate = meals.filter((m) => m.new_this_week);
  if (toUpdate.length === 0) {
    toast('Nothing is flagged "new this week".', 'info');
    return;
  }
  if (!confirm(`Clear "new this week" flag from ${toUpdate.length} meal(s)?`)) return;

  const ids = toUpdate.map((m) => m.id);
  const { error } = await supabase.from('meals').update({ new_this_week: false }).in('id', ids);
  if (error) { toast(error.message, 'error'); return; }
  writeAudit('bulk_clear_new', null, null, { count: ids.length, ids });
  toast(`Cleared "new this week" from ${ids.length} meals.`, 'success');
  await loadMeals();
}

// ---------- MODAL: open/close ----------

function openModal(id = null) {
  editing = id ? meals.find((m) => m.id === id) : null;
  els.modalTitle.textContent = editing ? `Edit "${editing.name}"` : 'New Meal';
  els.modalDelete.hidden = !editing;
  fillForm(editing);
  els.modal.showModal();
}
function closeModal() {
  if (els.modal.open) els.modal.close();
  editing = null;
}

// ---------- FORM helpers ----------

function fillForm(meal) {
  const f = els.form;
  if (!f) return;
  f.reset();
  if (!meal) {
    // Sensible defaults for a new meal
    f.category.value = 'signature';
    f.is_active.checked = true;
    f.sort_order.value = (meals.reduce((max, m) => Math.max(max, m.sort_order ?? 0), 0) + 10);
    setImagePreview('');
    return;
  }
  f.slug.value             = meal.slug || '';
  f.name.value             = meal.name || '';
  f.tagline.value          = meal.tagline || '';
  f.category.value         = meal.category || 'signature';
  f.description.value      = meal.description || '';
  f.image_url.value        = meal.image_url || '';
  f.kcal.value             = meal.kcal ?? '';
  f.protein_g.value        = meal.protein_g ?? '';
  f.carbs_g.value          = meal.carbs_g ?? '';
  f.fat_g.value            = meal.fat_g ?? '';
  f.price_single.value     = meal.price_single ?? '';
  f.price_bundle_5.value   = meal.price_bundle_5 ?? '';
  f.price_bundle_10.value  = meal.price_bundle_10 ?? '';
  f.tags.value             = (meal.tags || []).join(', ');
  f.protein_source.value   = meal.protein_source || '';
  f.goal_tags.value        = (meal.goal_tags || []).join(', ');
  f.ingredients.value      = meal.ingredients || '';
  f.allergens_contains.value     = (meal.allergens_contains || []).join(', ');
  f.allergens_may_contain.value  = (meal.allergens_may_contain || []).join(', ');
  f.heat_instructions.value      = meal.heat_instructions || '';
  f.storage.value          = meal.storage || '';
  f.sort_order.value       = meal.sort_order ?? 0;
  f.is_active.checked      = !!meal.is_active;
  f.new_this_week.checked  = !!meal.new_this_week;
  setImagePreview(meal.image_url);
}

function readForm() {
  const f = els.form;
  const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  return {
    slug:             (f.slug.value || '').trim(),
    name:             (f.name.value || '').trim(),
    tagline:          (f.tagline.value || '').trim() || null,
    category:         f.category.value || 'signature',
    description:      (f.description.value || '').trim() || null,
    image_url:        (f.image_url.value || '').trim() || null,
    kcal:             intOrNull(f.kcal.value),
    protein_g:        intOrNull(f.protein_g.value),
    carbs_g:          intOrNull(f.carbs_g.value),
    fat_g:            intOrNull(f.fat_g.value),
    price_single:     numOrNull(f.price_single.value),
    price_bundle_5:   numOrNull(f.price_bundle_5.value),
    price_bundle_10:  numOrNull(f.price_bundle_10.value),
    tags:             csv(f.tags.value),
    protein_source:   (f.protein_source.value || '').trim() || null,
    goal_tags:        csv(f.goal_tags.value),
    ingredients:      (f.ingredients.value || '').trim() || null,
    allergens_contains:    csv(f.allergens_contains.value),
    allergens_may_contain: csv(f.allergens_may_contain.value),
    heat_instructions:     (f.heat_instructions.value || '').trim() || null,
    storage:          (f.storage.value || '').trim() || null,
    sort_order:       intOrNull(f.sort_order.value) ?? 0,
    is_active:        !!f.is_active.checked,
    new_this_week:    !!f.new_this_week.checked
  };
}

function intOrNull(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function numOrNull(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

// ---------- IMAGE UPLOAD ----------

function setImagePreview(url) {
  if (!els.imgPreview) return;
  if (url) {
    els.imgPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="" />`;
  } else {
    els.imgPreview.innerHTML = 'Preview';
  }
}

async function uploadImage(file) {
  if (!file) return null;
  // Sanitize filename: slug + timestamp + ext
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const slug = (els.form.slug.value || 'meal').trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'meal';
  const fileName = `${slug}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('meal-images')
    .upload(fileName, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined
    });
  if (upErr) {
    toast(upErr.message || 'Image upload failed.', 'error');
    return null;
  }
  const { data: pub } = supabase.storage.from('meal-images').getPublicUrl(fileName);
  return pub?.publicUrl || null;
}

// ---------- SAVE ----------

async function saveMeal() {
  const data = readForm();
  if (!data.slug || !data.name) {
    toast('Slug and name are required.', 'error');
    return;
  }

  els.modalSave.disabled = true;
  const originalLabel = els.modalSave.textContent;
  els.modalSave.textContent = 'Saving…';

  // If a file was chosen, upload first and use the resulting URL.
  const file = els.imgFileInput?.files?.[0];
  if (file) {
    const url = await uploadImage(file);
    if (url) data.image_url = url;
    else {
      els.modalSave.disabled = false;
      els.modalSave.textContent = originalLabel;
      return;
    }
  }

  if (editing) {
    const before = { ...editing };
    const { error } = await supabase.from('meals').update(data).eq('id', editing.id);
    if (error) {
      els.modalSave.disabled = false;
      els.modalSave.textContent = originalLabel;
      toast(error.message || 'Could not save.', 'error');
      return;
    }
    writeAudit('updated_meal', editing.id, before, { ...before, ...data });
    toast('Meal updated.', 'success');
  } else {
    const { data: inserted, error } = await supabase.from('meals').insert(data).select().single();
    if (error) {
      els.modalSave.disabled = false;
      els.modalSave.textContent = originalLabel;
      toast(error.message || 'Could not create meal.', 'error');
      return;
    }
    writeAudit('created_meal', inserted.id, null, inserted);
    toast(`"${inserted.name}" added.`, 'success');
  }

  els.modalSave.disabled = false;
  els.modalSave.textContent = originalLabel;
  closeModal();
  await loadMeals();
}

// ---------- DELETE ----------

async function deleteMeal() {
  if (!editing) return;
  if (!confirm(
    `Delete "${editing.name}" permanently?\n\n` +
    `This cannot be undone. Past orders will keep their snapshot of the meal name and price.`
  )) return;

  const before = { ...editing };
  const { error } = await supabase.from('meals').delete().eq('id', editing.id);
  if (error) { toast(error.message, 'error'); return; }
  writeAudit('deleted_meal', editing.id, before, null);
  toast(`"${editing.name}" deleted.`, 'success');
  closeModal();
  await loadMeals();
}

// ---------- AUDIT LOG ----------

async function writeAudit(action, entityId, before, after) {
  if (!adminProfile?.id) return;
  await supabase.from('audit_log').insert({
    actor_id:    adminProfile.id,
    action:      action,
    entity_type: 'meal',
    entity_id:   entityId,
    before_data: before,
    after_data:  after
  });
  // Failures here are non-blocking — we don't want a missing audit row
  // to make the actual data change feel like it failed.
}

// ---------- HELPERS ----------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- WIRE UP ----------

els.search?.addEventListener('input', applyFilters);
els.categoryFilter?.addEventListener('change', applyFilters);
els.statusFilter?.addEventListener('change', applyFilters);

els.addBtn?.addEventListener('click', () => openModal(null));
els.bulkActive?.addEventListener('click', bulkSetActive);
els.bulkClearNew?.addEventListener('click', bulkClearNew);

els.modalClose?.addEventListener('click', closeModal);
els.modalCancel?.addEventListener('click', closeModal);
els.modalDelete?.addEventListener('click', deleteMeal);

els.form?.addEventListener('submit', (e) => {
  e.preventDefault();
  saveMeal();
});

// Live image preview from URL field
els.imgUrlInput?.addEventListener('change', () => setImagePreview(els.imgUrlInput.value));

// Live image preview from file input
els.imgFileInput?.addEventListener('change', () => {
  const file = els.imgFileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => setImagePreview(e.target.result);
  reader.readAsDataURL(file);
});

// ---------- INIT ----------

loadMeals();
