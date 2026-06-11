// =========================================================
// ADMIN OPENING & CLOSING CHECKS
// Two tabs (Opening / Closing). Each has a checklist + repeatable
// fridge/freezer temperature rows + notes, with a history table
// below and a CSV export. Admin-only (guarded by admin-shared).
//
// Warning logic (matches js/admin-fridge-temperatures.js):
//   checklist item answered "No" -> amber flag
//   fridge above 5°C / freezer above -18°C -> red (out of range)
// =========================================================

import './admin-shared.js';   // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

// ---------- CONFIG ----------

const CHECKS = {
  opening: {
    table: 'opening_checks',
    fk:    'opening_check_id',
    title: 'Opening',
    items: [
      ['surfaces_clean',   'Surfaces and equipment clean and ready'],
      ['date_labels_ok',   'Date labels in order / no out-of-date stock'],
      ['handwash_stocked', 'Handwashing station stocked (soap & paper towels)'],
      ['pest_check_ok',    'Pest check — no signs of overnight activity']
    ]
  },
  closing: {
    table: 'closing_checks',
    fk:    'closing_check_id',
    title: 'Closing',
    items: [
      ['food_covered',     'All food covered and stored correctly'],
      ['surfaces_cleaned', 'Surfaces cleaned down'],
      ['bins_emptied',     'Bins emptied'],
      ['equipment_off',    'Equipment switched off / locked down'],
      ['doors_secured',    'Doors and windows secured']
    ]
  }
};

// Loaded data per type, kept for CSV export: { checks: [], byParent: Map }
const store = { opening: null, closing: null };

// ---------- WARNING LOGIC ----------

// True when a reading is too warm for its unit type.
function isOutOfRange(unitType, tempC) {
  const t = Number(tempC);
  if (Number.isNaN(t)) return false;
  return unitType === 'freezer' ? t > -18 : t > 5;
}

// ---------- DATE / FORMAT HELPERS ----------

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

// ---------- TABS ----------

document.querySelectorAll('.admin-tab[data-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const type = tab.dataset.tab;
    document.querySelectorAll('.admin-tab[data-tab]').forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.oc-panel[data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== type;
    });
  });
});

// ---------- TEMPERATURE ROWS ----------

const tempTemplate = document.getElementById('temp-row-template');

function addTempRow(type) {
  const container = document.getElementById(`${type}-temps`);
  const frag = tempTemplate.content.cloneNode(true);
  const row = frag.querySelector('.temp-row');

  const tempInput = row.querySelector('.temp-row__temp');
  const typeSelect = row.querySelector('.temp-row__type');
  const flag = () => {
    const warn = tempInput.value.trim() !== '' && isOutOfRange(typeSelect.value, tempInput.value);
    tempInput.classList.toggle('is-warn', warn);
  };
  tempInput.addEventListener('input', flag);
  typeSelect.addEventListener('change', flag);

  row.querySelector('.temp-row__remove').addEventListener('click', () => {
    row.remove();
    // Always keep at least one row present.
    if (container.children.length === 0) addTempRow(type);
  });

  container.appendChild(row);
}

function resetTempRows(type) {
  document.getElementById(`${type}-temps`).innerHTML = '';
  addTempRow(type);
}

document.querySelectorAll('[data-add-temp]').forEach((btn) => {
  btn.addEventListener('click', () => addTempRow(btn.dataset.addTemp));
});

// ---------- SUBMIT ----------

async function submitCheck(type, e) {
  e.preventDefault();
  const cfg  = CHECKS[type];
  const form = document.getElementById(`${type}-form`);

  const whenLocal = document.getElementById(`${type}-when`).value;
  const staff     = document.getElementById(`${type}-staff`).value.trim();
  const notes     = document.getElementById(`${type}-notes`).value.trim();

  if (!staff || !whenLocal) {
    toast('Please fill in the date/time and staff name.', 'error');
    return;
  }
  const checkedAt = new Date(whenLocal);
  if (Number.isNaN(checkedAt.getTime())) {
    toast('That date / time looks wrong.', 'error');
    return;
  }

  // Checklist booleans (Yes = true / pass).
  const checklist = {};
  form.querySelectorAll('.check-item').forEach((item) => {
    const picked = item.querySelector('input:checked');
    checklist[item.dataset.key] = picked ? picked.value === 'yes' : false;
  });

  // Temperature rows — skip fully-empty rows, validate partial ones.
  const temps = [];
  let invalid = false;
  form.querySelectorAll('.temp-row').forEach((row) => {
    const unit = row.querySelector('.temp-row__unit').value.trim();
    const utype = row.querySelector('.temp-row__type').value;
    const traw = row.querySelector('.temp-row__temp').value.trim();
    if (!unit && traw === '') return;            // empty row → ignore
    if (!unit || traw === '') { invalid = true; return; }
    const t = Number(traw);
    if (Number.isNaN(t)) { invalid = true; return; }
    temps.push({ unit_name: unit, unit_type: utype, temperature_c: t });
  });
  if (invalid) {
    toast('Each temperature row needs both a unit name and a number.', 'error');
    return;
  }

  const saveBtn = document.getElementById(`${type}-save-btn`);
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  // 1. Insert the parent check record.
  const { data: parent, error } = await supabase
    .from(cfg.table)
    .insert({
      checked_at: checkedAt.toISOString(),
      staff_name: staff,
      notes: notes || null,
      ...checklist
    })
    .select('id')
    .single();

  if (error || !parent) {
    console.error('[oc-checks] insert parent', error);
    saveBtn.disabled = false;
    saveBtn.textContent = `Submit ${cfg.title} Check`;
    toast('Could not save the check. Please try again.', 'error');
    return;
  }

  // 2. Insert the linked temperature readings.
  if (temps.length) {
    const rows = temps.map((t) => ({ ...t, [cfg.fk]: parent.id }));
    const { error: tErr } = await supabase.from('check_temperature_readings').insert(rows);
    if (tErr) {
      console.error('[oc-checks] insert temps', tErr);
      toast('Check saved, but the temperatures failed to save.', 'error');
    }
  }

  saveBtn.disabled = false;
  saveBtn.textContent = `Submit ${cfg.title} Check`;

  const flagged = cfg.items.filter(([key]) => checklist[key] === false).length;
  const tempsWarn = temps.filter((t) => isOutOfRange(t.unit_type, t.temperature_c)).length;
  if (flagged || tempsWarn) {
    toast(`${cfg.title} check saved with ${flagged + tempsWarn} item(s) flagged — please review.`, 'error');
  } else {
    toast(`${cfg.title} check saved.`, 'success');
  }

  resetForm(type);
  loadHistory(type);
}

function resetForm(type) {
  const form = document.getElementById(`${type}-form`);
  form.reset();                                   // checklist → Yes, clears staff/notes
  document.getElementById(`${type}-when`).value = toLocalInput(new Date());
  resetTempRows(type);
}

// ---------- HISTORY ----------

async function loadHistory(type) {
  const cfg = CHECKS[type];
  const container = document.getElementById(`${type}-history`);

  const { data: checks, error } = await supabase
    .from(cfg.table)
    .select('*')
    .order('checked_at', { ascending: false });

  if (error) {
    console.error('[oc-checks] load history', error);
    container.innerHTML = `<p class="admin-table__empty">Unable to load history.</p>`;
    return;
  }

  // Pull all linked readings in one query, then group by parent id.
  const ids = (checks || []).map((c) => c.id);
  const byParent = new Map();
  if (ids.length) {
    const { data: readings } = await supabase
      .from('check_temperature_readings')
      .select('*')
      .in(cfg.fk, ids);
    (readings || []).forEach((r) => {
      const k = r[cfg.fk];
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(r);
    });
  }

  store[type] = { checks: checks || [], byParent };
  renderHistory(type, checks || [], byParent);
}

function renderHistory(type, checks, byParent) {
  const cfg = CHECKS[type];
  const container = document.getElementById(`${type}-history`);

  if (checks.length === 0) {
    container.innerHTML = `<p class="admin-table__empty">No ${cfg.title.toLowerCase()} checks recorded yet.</p>`;
    return;
  }

  const rows = checks.map((check, i) => {
    const temps = byParent.get(check.id) || [];
    const flagged = cfg.items.filter(([key]) => check[key] === false).length;
    const tempsWarn = temps.filter((t) => isOutOfRange(t.unit_type, t.temperature_c)).length;

    const checklistPill = flagged === 0
      ? `<span class="check-pill check-pill--pass">All pass</span>`
      : `<span class="check-pill check-pill--flag">${flagged} flagged</span>`;

    const tempsPill = temps.length === 0
      ? `<span class="check-pill check-pill--muted">No temps</span>`
      : (tempsWarn === 0
          ? `<span class="check-pill check-pill--pass">All in range</span>`
          : `<span class="check-pill check-pill--bad">${tempsWarn} out of range</span>`);

    const detailId = `${type}-detail-${i}`;

    const checklistDetail = cfg.items.map(([key, label]) => `
      <div class="check-detail__item">
        <span>${escapeHtml(label)}</span>
        ${check[key]
          ? '<span class="check-pill check-pill--pass">Yes</span>'
          : '<span class="check-pill check-pill--flag">No</span>'}
      </div>
    `).join('');

    const tempsDetail = temps.length === 0
      ? `<p class="check-detail__notes">No temperatures recorded.</p>`
      : temps.map((t) => {
          const warn = isOutOfRange(t.unit_type, t.temperature_c);
          const temp = Number(t.temperature_c);
          const tempStr = Number.isNaN(temp) ? escapeHtml(t.temperature_c) : `${temp.toFixed(1)}°C`;
          return `
            <div class="check-detail__temp">
              <strong style="color: var(--cream);">${escapeHtml(t.unit_name)}</strong>
              <span class="temp-badge ${warn ? 'temp-badge--warn' : 'temp-badge--ok'}">${tempStr}</span>
              <span class="ft-unit-type">${escapeHtml(t.unit_type)}</span>
            </div>`;
        }).join('');

    return `
      <tr class="check-row--summary" data-detail="${detailId}">
        <td><span class="check-row__caret">▸</span>${escapeHtml(formatWhen(check.checked_at))}</td>
        <td>${escapeHtml(check.staff_name)}</td>
        <td>${checklistPill}</td>
        <td>${tempsPill}</td>
        <td>${escapeHtml(check.notes || '')}</td>
      </tr>
      <tr class="check-detail-row" id="${detailId}" hidden>
        <td colspan="5">
          <div class="check-detail">
            <div class="check-detail__block">
              <h4>Checklist</h4>
              <div class="check-detail__items">${checklistDetail}</div>
            </div>
            <div class="check-detail__block">
              <h4>Temperatures</h4>
              <div class="check-detail__temps">${tempsDetail}</div>
            </div>
            ${check.notes ? `
              <div class="check-detail__block">
                <h4>Notes / Issues</h4>
                <p class="check-detail__notes">${escapeHtml(check.notes)}</p>
              </div>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Staff</th>
            <th>Checklist</th>
            <th>Temps</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="admin-footer-count">${checks.length} check${checks.length === 1 ? '' : 's'}</p>
  `;

  // Expand / collapse on row click.
  container.querySelectorAll('.check-row--summary').forEach((row) => {
    row.addEventListener('click', () => {
      const detail = document.getElementById(row.dataset.detail);
      if (!detail) return;
      detail.hidden = !detail.hidden;
      row.classList.toggle('is-open', !detail.hidden);
    });
  });
}

// ---------- CSV EXPORT ----------

function exportCsv(type) {
  const cfg = CHECKS[type];
  const data = store[type];
  if (!data || data.checks.length === 0) {
    toast('Nothing to export.', 'info');
    return;
  }

  const itemKeys = cfg.items.map(([key]) => key);
  const headers = [
    'checked_at', 'staff_name', ...itemKeys, 'notes',
    'unit_name', 'unit_type', 'temperature_c', 'within_safe_range', 'temp_logged_at'
  ];

  const rows = [headers];
  data.checks.forEach((check) => {
    const base = [
      check.checked_at,
      check.staff_name,
      ...itemKeys.map((k) => (check[k] ? 'yes' : 'NO')),
      check.notes || ''
    ];
    const temps = data.byParent.get(check.id) || [];
    if (temps.length === 0) {
      rows.push([...base, '', '', '', '', '']);
    } else {
      temps.forEach((t) => {
        rows.push([
          ...base,
          t.unit_name,
          t.unit_type,
          t.temperature_c,
          isOutOfRange(t.unit_type, t.temperature_c) ? 'NO' : 'yes',
          t.created_at
        ]);
      });
    }
  });

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const fileName = `deli-depot-${type}-checks.csv`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('CSV downloaded.', 'success');
}

// ---------- WIRE UP ----------

document.getElementById('opening-form').addEventListener('submit', (e) => submitCheck('opening', e));
document.getElementById('closing-form').addEventListener('submit', (e) => submitCheck('closing', e));

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => exportCsv(btn.dataset.export));
});

// ---------- INIT ----------

['opening', 'closing'].forEach((type) => {
  document.getElementById(`${type}-when`).value = toLocalInput(new Date());
  resetTempRows(type);
  loadHistory(type);
});
