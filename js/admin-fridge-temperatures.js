// =========================================================
// ADMIN FRIDGE TEMPERATURES
// Staff log fridge/freezer temperatures as EHO evidence.
// Form to add a reading + table of past readings (newest first)
// with an out-of-range warning highlight + CSV export.
//
// Safe thresholds:
//   fridge / chiller — warn if above 5°C
//   freezer          — warn if above -18°C
// (A freezer sitting well below -18°C is GOOD, so we only flag
//  units that are too WARM — the actual food-safety risk.)
// =========================================================

import './admin-shared.js';   // guard + sidebar
import { supabase } from './supabase.js';
import { toast } from './toast.js';

// ---------- STATE ----------

const state = {
  from: null,   // Date | null  (inclusive day start)
  to:   null,   // Date | null  (inclusive day end)
  logs: []      // currently-loaded rows
};

// ---------- DOM REFS ----------

const els = {
  form:      document.getElementById('ft-form'),
  unit:      document.getElementById('ft-unit'),
  type:      document.getElementById('ft-type'),
  temp:      document.getElementById('ft-temp'),
  readingAt: document.getElementById('ft-reading-at'),
  staff:     document.getElementById('ft-staff'),
  notes:     document.getElementById('ft-notes'),
  saveBtn:   document.getElementById('ft-save-btn'),

  from:      document.getElementById('ft-from'),
  to:        document.getElementById('ft-to'),
  applyBtn:  document.getElementById('ft-apply'),
  clearBtn:  document.getElementById('ft-clear'),
  exportBtn: document.getElementById('ft-export'),

  table:     document.getElementById('ft-table')
};

// ---------- WARNING LOGIC ----------

// True when a reading is too warm for its unit type.
function isOutOfRange(unitType, tempC) {
  const t = Number(tempC);
  if (Number.isNaN(t)) return false;
  return unitType === 'freezer' ? t > -18 : t > 5;
}

// ---------- DATE HELPERS ----------

function pad(n) { return String(n).padStart(2, '0'); }

// Date -> value for <input type="datetime-local"> in LOCAL time.
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ISO timestamp -> friendly local string for the table.
function formatReading(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ---------- LOAD + RENDER ----------

async function loadLogs() {
  let query = supabase
    .from('fridge_temperature_logs')
    .select('*')
    .order('reading_at', { ascending: false });

  if (state.from) query = query.gte('reading_at', state.from.toISOString());
  if (state.to)   query = query.lte('reading_at', state.to.toISOString());

  const { data, error } = await query;
  if (error) {
    console.error('[fridge-temps] load error', error);
    toast('Could not load temperature logs.', 'error');
    els.table.innerHTML = `<p class="admin-table__empty">Unable to load logs.</p>`;
    return;
  }

  state.logs = data || [];
  renderTable(state.logs);
}

function renderTable(logs) {
  if (logs.length === 0) {
    els.table.innerHTML = `<p class="admin-table__empty">No readings logged${state.from || state.to ? ' for this date range' : ' yet'}.</p>`;
    return;
  }

  els.table.innerHTML = `
    <div class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Fridge / Unit</th>
            <th>Temp (°C)</th>
            <th>Staff</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map((log) => {
            const warn = isOutOfRange(log.unit_type, log.temperature_c);
            const temp = Number(log.temperature_c);
            const tempStr = Number.isNaN(temp) ? escapeHtml(log.temperature_c) : `${temp.toFixed(1)}°C`;
            return `
              <tr class="${warn ? 'ft-row--warn' : ''}">
                <td>${escapeHtml(formatReading(log.reading_at))}</td>
                <td>
                  <strong style="color: var(--cream);">${escapeHtml(log.unit_name)}</strong>
                  <div class="ft-unit-type">${escapeHtml(log.unit_type)}</div>
                </td>
                <td>
                  <span class="temp-badge ${warn ? 'temp-badge--warn' : 'temp-badge--ok'}">${tempStr}</span>
                  ${warn ? '<span class="ft-warn-flag">Too warm</span>' : ''}
                </td>
                <td>${escapeHtml(log.staff_name)}</td>
                <td>${escapeHtml(log.notes || '')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="admin-footer-count">${logs.length} reading${logs.length === 1 ? '' : 's'}</p>
  `;
}

// ---------- ADD A READING ----------

async function submitReading(e) {
  e.preventDefault();

  const unit  = els.unit.value.trim();
  const type  = els.type.value;
  const tempRaw = els.temp.value.trim();
  const staff = els.staff.value.trim();
  const notes = els.notes.value.trim();
  const readingLocal = els.readingAt.value;

  if (!unit || tempRaw === '' || !staff || !readingLocal) {
    toast('Please fill in unit, temperature, date/time and staff.', 'error');
    return;
  }

  const tempC = Number(tempRaw);
  if (Number.isNaN(tempC)) {
    toast('Temperature must be a number.', 'error');
    return;
  }

  // datetime-local is in the browser's local zone; convert to a real instant.
  const readingAt = new Date(readingLocal);
  if (Number.isNaN(readingAt.getTime())) {
    toast('That date / time looks wrong.', 'error');
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Saving…';

  const { error } = await supabase.from('fridge_temperature_logs').insert({
    unit_name:     unit,
    unit_type:     type,
    temperature_c: tempC,
    reading_at:    readingAt.toISOString(),
    staff_name:    staff,
    notes:         notes || null
  });

  els.saveBtn.disabled = false;
  els.saveBtn.textContent = 'Save Reading';

  if (error) {
    console.error('[fridge-temps] insert error', error);
    toast('Could not save the reading. Please try again.', 'error');
    return;
  }

  if (isOutOfRange(type, tempC)) {
    toast(`Saved — but ${unit} is above the safe limit. Check the unit.`, 'error');
  } else {
    toast('Reading saved.', 'success');
  }

  // Keep unit / type / staff for repeated logging; reset the rest to "now".
  els.temp.value = '';
  els.notes.value = '';
  els.readingAt.value = toLocalInput(new Date());
  els.temp.focus();

  await loadLogs();
}

// ---------- CSV EXPORT ----------

function exportCsv() {
  if (state.logs.length === 0) {
    toast('Nothing to export.', 'info');
    return;
  }

  const headers = ['reading_at', 'unit_name', 'unit_type', 'temperature_c', 'within_safe_range', 'staff_name', 'notes', 'logged_at'];
  const rows = [headers];
  state.logs.forEach((log) => {
    rows.push([
      log.reading_at,
      log.unit_name,
      log.unit_type,
      log.temperature_c,
      isOutOfRange(log.unit_type, log.temperature_c) ? 'NO' : 'yes',
      log.staff_name,
      log.notes || '',
      log.created_at
    ]);
  });

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const rangeLabel = (state.from || state.to)
    ? `${state.from ? toDateISO(state.from) : 'start'}-to-${state.to ? toDateISO(state.to) : 'now'}`
    : 'all';
  const fileName = `deli-depot-fridge-temps-${rangeLabel}.csv`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('CSV downloaded.', 'success');
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- HELPERS ----------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- WIRE UP ----------

els.form?.addEventListener('submit', submitReading);

els.applyBtn?.addEventListener('click', () => {
  state.from = els.from.value ? new Date(`${els.from.value}T00:00:00`) : null;
  state.to   = els.to.value   ? new Date(`${els.to.value}T23:59:59`)   : null;
  if (state.from && state.to && state.from > state.to) {
    toast('Start date must be before end date.', 'error');
    return;
  }
  loadLogs();
});

els.clearBtn?.addEventListener('click', () => {
  els.from.value = '';
  els.to.value = '';
  state.from = null;
  state.to = null;
  loadLogs();
});

els.exportBtn?.addEventListener('click', exportCsv);

// ---------- INIT ----------

els.readingAt.value = toLocalInput(new Date());
loadLogs();
