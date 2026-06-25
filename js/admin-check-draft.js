// =========================================================
// ADMIN CHECK DRAFTS — "saves as you go" for the food-safety
// check forms (opening, closing, fridge temps, deliveries).
//
// As staff fill a check in, the in-progress values are auto-saved
// to this device (localStorage) on a short debounce. If the phone
// closes, the tab is lost, or they get interrupted mid-check, the
// draft is restored next time the page loads. The draft is cleared
// once the check is successfully filed (the "Complete" submit).
//
// Drafts are intentionally LOCAL — the permanent record still goes
// to Supabase on submit. The draft only protects unfinished work.
// =========================================================

const PREFIX = 'dd_draft_';

export function loadDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}

export function clearDraft(key) {
  localStorage.removeItem(PREFIX + key);
}

// Returns a debounced saver: call it with the current snapshot object
// whenever a field changes. Updates the optional status element so staff
// can see their progress is being kept.
export function makeDraftSaver(key, statusEl, delay = 350) {
  let timer;
  function setStatus(text, state) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.state = state || '';
  }
  const save = (data) => {
    clearTimeout(timer);
    setStatus('Saving…', 'saving');
    timer = setTimeout(() => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(data));
        setStatus('Draft saved on this device', 'saved');
      } catch {
        setStatus('Could not save draft', 'error');
      }
    }, delay);
  };
  save.flushClear = () => { clearTimeout(timer); clearDraft(key); setStatus('', ''); };
  save.setStatus = setStatus;
  return save;
}
