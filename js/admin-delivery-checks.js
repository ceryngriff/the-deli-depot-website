// =========================================================
// ADMIN DELIVERY CHECKS
// Staff record a food-safety check on each delivery (supplier,
// packaging, dates, allergen labelling, chilled/frozen probe temps,
// accept/reject) as EHO evidence. Saves a draft as they go and files
// the permanent record to Supabase on "Complete".
//
// Warning logic:
//   any checklist item "No"          -> amber flag
//   chilled probe above 8°C          -> red (out of range)
//   frozen probe above -15°C         -> red (not cold enough)
//   outcome "rejected"               -> shown as a red pill
// =========================================================

import './admin-shared.js';   // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { loadDraft, makeDraftSaver } from './admin-check-draft.js';

const DRAFT_KEY = 'delivery';

const CHECK_ITEMS = [
  ['packaging_ok', 'Packaging intact and undamaged'],
  ['dates_ok',     'All items in date (use-by / best-before OK)'],
  ['labels_ok',    'Allergen / ingredient labelling correct'],
  ['no_damage',    'No contamination or signs of pest damage']
];

const OUTCOME_LABELS = {
  accepted:            'Accepted',
  accepted_with_note:  'Accepted with note',
  rejected:            'Rejected'
};

let logs = [];   // loaded rows, kept for CSV export

// ---------- DOM ----------

const els = {
  form:     document.getElementById('delivery-form'),
  when:     document.getElementById('delivery-when'),
  staff:    document.getElementById('delivery-staff'),
  supplier: document.getElementById('delivery-supplier'),
  items:    document.getElementById('delivery-items'),
  chilled:  document.getElementById('delivery-chilled'),
  frozen:   document.getElementById('delivery-frozen'),
  outcome:  document.getElementById('delivery-outcome'),
  notes:    document.getElementById('delivery-notes'),
  saveBtn:  document.getElementById('delivery-save-btn'),
  history:  document.getElementById('delivery-history'),
  export:   document.getElementById('delivery-export'),
  status:   document.querySelector('[data-draft-status]')
};

const saveDraft = makeDraftSaver(DRAFT_KEY, els.status);

// ---------- WARNING LOGIC ----------

function chilledWarn(t) {
  const n = Number(t);
  return !Number.isNaN(n) && t !== '' && t != null && n > 8;
}
function frozenWarn(t) {
  const n = Number(t);
  return !Number.isNaN(n) && t !== '' && t != null && n > -15;
}

// ---------- HELPERS ----------

function pad(n) { return String(n).padStart(2, '0'); }
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function tempStr(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : `${n.toFixed(1)}°C`;
}

// ---------- DRAFT (save as you go) ----------

function getChecklist() {
  const out = {};
  els.form.querySelectorAll('.check-item').forEach((item) => {
    const picked = item.querySelector('input:checked');
    out[item.dataset.key] = picked ? picked.value : 'yes';
  });
  return out;
}

function snapshot() {
  return {
    when:     els.when.value,
    staff:    els.staff.value,
    supplier: els.supplier.value,
    items:    els.items.value,
    chilled:  els.chilled.value,
    frozen:   els.frozen.value,
    outcome:  els.outcome.value,
    notes:    els.notes.value,
    checklist: getChecklist()
  };
}

function restore(d) {
  if (!d) return;
  if (d.when) els.when.value = d.when;
  if (d.staff != null) els.staff.value = d.staff;
  if (d.supplier != null) els.supplier.value = d.supplier;
  if (d.items != null) els.items.value = d.items;
  if (d.chilled != null) els.chilled.value = d.chilled;
  if (d.frozen != null) els.frozen.value = d.frozen;
  if (d.outcome) els.outcome.value = d.outcome;
  if (d.notes != null) els.notes.value = d.notes;
  if (d.checklist) {
    Object.entries(d.checklist).forEach(([key, val]) => {
      const radio = els.form.querySelector(`input[name="dl-${key}"][value="${val}"]`);
      if (radio) radio.checked = true;
    });
  }
}

// Any edit auto-saves the in-progress draft.
els.form.addEventListener('input', () => saveDraft(snapshot()));
els.form.addEventListener('change', () => saveDraft(snapshot()));

// ---------- SUBMIT (Complete) ----------

async function submitCheck(e) {
  e.preventDefault();

  const whenLocal = els.when.value;
  const staff     = els.staff.value.trim();
  const supplier  = els.supplier.value.trim();

  if (!staff || !supplier || !whenLocal) {
    toast('Please fill in date/time, staff and supplier.', 'error');
    return;
  }
  const checkedAt = new Date(whenLocal);
  if (Number.isNaN(checkedAt.getTime())) {
    toast('That date / time looks wrong.', 'error');
    return;
  }

  const checklist = {};
  els.form.querySelectorAll('.check-item').forEach((item) => {
    const picked = item.querySelector('input:checked');
    checklist[item.dataset.key] = picked ? picked.value === 'yes' : false;
  });

  const chilledRaw = els.chilled.value.trim();
  const frozenRaw  = els.frozen.value.trim();
  const chilled = chilledRaw === '' ? null : Number(chilledRaw);
  const frozen  = frozenRaw === ''  ? null : Number(frozenRaw);
  if ((chilledRaw !== '' && Number.isNaN(chilled)) || (frozenRaw !== '' && Number.isNaN(frozen))) {
    toast('Temperatures must be numbers.', 'error');
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Saving…';

  const { error } = await supabase.from('delivery_checks').insert({
    checked_at:     checkedAt.toISOString(),
    staff_name:     staff,
    supplier,
    items_received: els.items.value.trim() || null,
    chilled_temp_c: chilled,
    frozen_temp_c:  frozen,
    outcome:        els.outcome.value,
    notes:          els.notes.value.trim() || null,
    ...checklist
  });

  els.saveBtn.disabled = false;
  els.saveBtn.textContent = 'Complete Delivery Check';

  if (error) {
    console.error('[delivery-checks] insert error', error);
    toast('Could not save the delivery check. Please try again.', 'error');
    return;
  }

  // Filed successfully — clear the draft and reset.
  saveDraft.flushClear();

  const flagged = CHECK_ITEMS.filter(([key]) => checklist[key] === false).length;
  const tempsWarn = (chilledWarn(chilled) ? 1 : 0) + (frozenWarn(frozen) ? 1 : 0);
  if (els.outcome.value === 'rejected') {
    toast('Delivery check saved — recorded as REJECTED.', 'error');
  } else if (flagged || tempsWarn) {
    toast(`Delivery check saved with ${flagged + tempsWarn} item(s) flagged — please review.`, 'error');
  } else {
    toast('Delivery check saved.', 'success');
  }

  resetForm();
  loadHistory();
}

function resetForm() {
  els.form.reset();                            // checklist → Yes, clears text
  els.when.value = toLocalInput(new Date());
  els.status.textContent = '';
}

// ---------- HISTORY ----------

async function loadHistory() {
  const { data, error } = await supabase
    .from('delivery_checks')
    .select('*')
    .order('checked_at', { ascending: false });

  if (error) {
    console.error('[delivery-checks] load history', error);
    els.history.innerHTML = `<p class="admin-table__empty">Unable to load history.</p>`;
    return;
  }

  logs = data || [];
  renderHistory(logs);
}

function renderHistory(rows) {
  if (rows.length === 0) {
    els.history.innerHTML = `<p class="admin-table__empty">No delivery checks recorded yet.</p>`;
    return;
  }

  const body = rows.map((c, i) => {
    const flagged = CHECK_ITEMS.filter(([key]) => c[key] === false).length;
    const tempsWarn = (chilledWarn(c.chilled_temp_c) ? 1 : 0) + (frozenWarn(c.frozen_temp_c) ? 1 : 0);

    const checklistPill = flagged === 0
      ? `<span class="check-pill check-pill--pass">All pass</span>`
      : `<span class="check-pill check-pill--flag">${flagged} flagged</span>`;

    const outcomePill = c.outcome === 'rejected'
      ? `<span class="check-pill check-pill--bad">Rejected</span>`
      : (c.outcome === 'accepted_with_note'
          ? `<span class="check-pill check-pill--flag">With note</span>`
          : `<span class="check-pill check-pill--pass">Accepted</span>`);

    const detailId = `delivery-detail-${i}`;

    const checklistDetail = CHECK_ITEMS.map(([key, label]) => `
      <div class="check-detail__item">
        <span>${escapeHtml(label)}</span>
        ${c[key]
          ? '<span class="check-pill check-pill--pass">Yes</span>'
          : '<span class="check-pill check-pill--flag">No</span>'}
      </div>
    `).join('');

    const tempRows = [];
    if (c.chilled_temp_c != null) {
      const warn = chilledWarn(c.chilled_temp_c);
      tempRows.push(`
        <div class="check-detail__temp">
          <strong style="color: var(--cream);">Chilled</strong>
          <span class="temp-badge ${warn ? 'temp-badge--warn' : 'temp-badge--ok'}">${tempStr(c.chilled_temp_c)}</span>
        </div>`);
    }
    if (c.frozen_temp_c != null) {
      const warn = frozenWarn(c.frozen_temp_c);
      tempRows.push(`
        <div class="check-detail__temp">
          <strong style="color: var(--cream);">Frozen</strong>
          <span class="temp-badge ${warn ? 'temp-badge--warn' : 'temp-badge--ok'}">${tempStr(c.frozen_temp_c)}</span>
        </div>`);
    }
    const tempsDetail = tempRows.length ? tempRows.join('') : `<p class="check-detail__notes">No temperatures recorded.</p>`;

    return `
      <tr class="check-row--summary" data-detail="${detailId}">
        <td><span class="check-row__caret">▸</span>${escapeHtml(formatWhen(c.checked_at))}</td>
        <td>${escapeHtml(c.supplier)}</td>
        <td>${escapeHtml(c.staff_name)}</td>
        <td>${checklistPill}</td>
        <td>${outcomePill}</td>
      </tr>
      <tr class="check-detail-row" id="${detailId}" hidden>
        <td colspan="5">
          <div class="check-detail">
            <div class="check-detail__block">
              <h4>Items received</h4>
              <p class="check-detail__notes">${escapeHtml(c.items_received || '—')}</p>
            </div>
            <div class="check-detail__block">
              <h4>Checklist</h4>
              <div class="check-detail__items">${checklistDetail}</div>
            </div>
            <div class="check-detail__block">
              <h4>Temperatures</h4>
              <div class="check-detail__temps">${tempsDetail}</div>
            </div>
            ${c.notes ? `
              <div class="check-detail__block">
                <h4>Notes / Issues</h4>
                <p class="check-detail__notes">${escapeHtml(c.notes)}</p>
              </div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  els.history.innerHTML = `
    <div class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Supplier</th>
            <th>Staff</th>
            <th>Checklist</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="admin-footer-count">${rows.length} check${rows.length === 1 ? '' : 's'}</p>
  `;

  els.history.querySelectorAll('.check-row--summary').forEach((row) => {
    row.addEventListener('click', () => {
      const detail = document.getElementById(row.dataset.detail);
      if (!detail) return;
      detail.hidden = !detail.hidden;
      row.classList.toggle('is-open', !detail.hidden);
    });
  });
}

// ---------- CSV EXPORT ----------

function exportCsv() {
  if (logs.length === 0) {
    toast('Nothing to export.', 'info');
    return;
  }
  const itemKeys = CHECK_ITEMS.map(([key]) => key);
  const headers = [
    'checked_at', 'supplier', 'staff_name', 'items_received',
    ...itemKeys, 'chilled_temp_c', 'frozen_temp_c', 'outcome', 'notes', 'logged_at'
  ];
  const rows = [headers];
  logs.forEach((c) => {
    rows.push([
      c.checked_at,
      c.supplier,
      c.staff_name,
      c.items_received || '',
      ...itemKeys.map((k) => (c[k] ? 'yes' : 'NO')),
      c.chilled_temp_c ?? '',
      c.frozen_temp_c ?? '',
      OUTCOME_LABELS[c.outcome] || c.outcome,
      c.notes || '',
      c.created_at
    ]);
  });

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'deli-depot-delivery-checks.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('CSV downloaded.', 'success');
}

// ---------- WIRE UP ----------

els.form.addEventListener('submit', submitCheck);
els.export.addEventListener('click', exportCsv);

// ---------- INIT ----------

const draft = loadDraft(DRAFT_KEY);
if (draft) {
  restore(draft);
  if (!draft.when) els.when.value = toLocalInput(new Date());
  saveDraft.setStatus('Unfinished draft restored', 'saved');
} else {
  els.when.value = toLocalInput(new Date());
}
loadHistory();
