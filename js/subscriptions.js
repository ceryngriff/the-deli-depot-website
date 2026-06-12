// =========================================================
// SUBSCRIPTIONS — plan cards + signup wizard
// Supports ?edit=<sub-id> to edit an existing subscription.
// =========================================================

import { supabase } from './supabase.js';
import { getSession } from './auth.js';
import { toast } from './toast.js';

// ---------- WIZARD STATE ----------

const PLANS = {
  set_and_forget: {
    name: 'Set & Forget',
    pickMeals: true,
    blurb: 'Same meals every week, picked once. Skip the menu every Sunday.'
  },
  surprise_me: {
    name: 'Surprise Me',
    pickMeals: false,
    blurb: 'Chef picks 5 rotating meals each week. The best of what\'s in season.'
  },
  custom: {
    name: 'Custom',
    pickMeals: true,
    blurb: 'Pick fresh from the live menu each week. Maximum flexibility.'
  }
};

const COLLECTION_DAYS = [
  { value: 'monday',    label: 'Monday' },
  { value: 'tuesday',   label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday' },
  { value: 'friday',    label: 'Friday' },
  { value: 'saturday',  label: 'Saturday' }
];

const TIME_SLOTS = [
  { value: '08:00', label: '8:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '17:00', label: '5:00 PM' }
];

const state = {
  step: 1,
  plan: null,
  mealsPerWeek: 5,
  collectionDay: 'monday',
  collectionTime: '17:00',
  selectedMealIds: [],
  editId: null,
  // Loaded once
  meals: []
};

// ---------- DOM REFS ----------

const modal       = document.getElementById('wizard');
const contentEl   = document.getElementById('wizard-content');
const stepInd     = document.getElementById('wizard-step-indicator');
const backBtn     = document.getElementById('wizard-back');
const nextBtn     = document.getElementById('wizard-next');
const closeBtn    = document.getElementById('wizard-close');
const errorEl     = document.getElementById('wizard-error');

// ---------- STEP COUNT ----------

function totalSteps() {
  // 1 = plan, 2 = meals/wk, 3 = collection, 4 = pick meals (if applicable), 5 = confirm
  return PLANS[state.plan]?.pickMeals ? 5 : 4;
}

function currentStepLabel(step) {
  if (state.plan && !PLANS[state.plan].pickMeals && step === 4) return 'Confirm';
  const labels = ['Plan', 'Meals/wk', 'Collection', 'Choose Meals', 'Confirm'];
  return labels[step - 1];
}

// ---------- RENDER ----------

function renderStepIndicator() {
  if (!stepInd) return;
  const total = totalSteps();
  let html = '';
  for (let i = 1; i <= total; i++) {
    const klass = i === state.step ? 'is-active'
                : i < state.step ? 'is-done'
                : '';
    html += `<span class="${klass}">${i}. ${currentStepLabel(i)}</span>`;
    if (i < total) html += '<span aria-hidden="true">→</span>';
  }
  stepInd.innerHTML = html;
}

function renderStep() {
  hideError();
  renderStepIndicator();

  if (state.step === 1) renderStepPlan();
  else if (state.step === 2) renderStepMealsPerWeek();
  else if (state.step === 3) renderStepCollection();
  else if (state.step === 4) {
    if (PLANS[state.plan].pickMeals) renderStepPickMeals();
    else renderStepConfirm();
  }
  else if (state.step === 5) renderStepConfirm();

  // Back button visibility
  if (backBtn) backBtn.style.visibility = state.step > 1 ? 'visible' : 'hidden';
  if (state.editId && state.step === 1) {
    // Can't change plan when editing — skip ahead
    state.step = 2;
    renderStep();
    return;
  }

  // Next button label
  if (nextBtn) {
    if (state.step === totalSteps()) nextBtn.textContent = state.editId ? 'Save Changes' : 'Subscribe';
    else nextBtn.textContent = 'Continue';
  }
}

function renderStepPlan() {
  contentEl.innerHTML = `
    <h2 class="wizard__title">Choose your plan</h2>
    <p class="wizard__subtitle">All plans save 10% vs. the per-meal bundle price. Pause or cancel anytime.</p>
    <div class="wizard__options">
      ${Object.entries(PLANS).map(([key, p]) => `
        <button type="button" class="wizard-option ${state.plan === key ? 'is-selected' : ''}"
                data-plan="${key}">
          <span class="wizard-option__big" style="font-size: 1.2rem;">${escapeHtml(p.name)}</span>
          <span class="wizard-option__label" style="text-transform: none; letter-spacing: 0.02em; color: var(--cream-muted); font-size: 0.85rem; line-height: 1.4;">${escapeHtml(p.blurb)}</span>
        </button>
      `).join('')}
    </div>
  `;
  contentEl.querySelectorAll('[data-plan]').forEach((b) => {
    b.addEventListener('click', () => {
      state.plan = b.dataset.plan;
      renderStep();
    });
  });
}

function renderStepMealsPerWeek() {
  contentEl.innerHTML = `
    <h2 class="wizard__title">How many meals per week?</h2>
    <p class="wizard__subtitle">Pick the cadence that suits your schedule. You can change this later.</p>
    <div class="wizard__options wizard__options--columns">
      ${[3, 5, 7].map((n) => `
        <button type="button" class="wizard-option ${state.mealsPerWeek === n ? 'is-selected' : ''}"
                data-meals="${n}">
          <span class="wizard-option__big">${n}</span>
          <span class="wizard-option__label">${n === 1 ? 'meal' : 'meals'} / week</span>
        </button>
      `).join('')}
    </div>
  `;
  contentEl.querySelectorAll('[data-meals]').forEach((b) => {
    b.addEventListener('click', () => {
      state.mealsPerWeek = parseInt(b.dataset.meals, 10);
      // Trim any over-selected meals if user reduced the count
      if (state.selectedMealIds.length > state.mealsPerWeek) {
        state.selectedMealIds = state.selectedMealIds.slice(0, state.mealsPerWeek);
      }
      renderStep();
    });
  });
}

function renderStepCollection() {
  contentEl.innerHTML = `
    <h2 class="wizard__title">When do you collect?</h2>
    <p class="wizard__subtitle">Pick your usual day and time. Your subscription will renew weekly on this slot.</p>
    <div class="wizard__row">
      <label class="wizard__field">
        <span>Collection day</span>
        <select id="sub-day">
          ${COLLECTION_DAYS.map((d) => `
            <option value="${d.value}" ${d.value === state.collectionDay ? 'selected' : ''}>${escapeHtml(d.label)}</option>
          `).join('')}
        </select>
      </label>
      <label class="wizard__field">
        <span>Collection time</span>
        <select id="sub-time">
          ${TIME_SLOTS.map((t) => `
            <option value="${t.value}" ${t.value === state.collectionTime ? 'selected' : ''}>${escapeHtml(t.label)}</option>
          `).join('')}
        </select>
      </label>
    </div>
  `;
  document.getElementById('sub-day')?.addEventListener('change', (e) => {
    state.collectionDay = e.target.value;
  });
  document.getElementById('sub-time')?.addEventListener('change', (e) => {
    state.collectionTime = e.target.value;
  });
}

function renderStepPickMeals() {
  const planName = PLANS[state.plan].name;
  contentEl.innerHTML = `
    <h2 class="wizard__title">Pick your meals</h2>
    <p class="wizard__subtitle">
      ${state.plan === 'custom'
        ? 'These are your starter meals — you can swap them every week from the live menu.'
        : `Your ${state.mealsPerWeek} meals for every weekly delivery.`}
    </p>
    <div class="sub-meals-header">
      <span class="sub-meals-count">Selected <strong id="meals-selected">${state.selectedMealIds.length}</strong> / ${state.mealsPerWeek}</span>
    </div>
    <div id="sub-meals-grid" class="sub-meals-grid">
      ${state.meals.map((meal) => mealCardHtml(meal)).join('')}
    </div>
  `;
  contentEl.querySelectorAll('.sub-meal').forEach((card) => {
    card.addEventListener('click', (e) => {
      // The card is a <label> wrapping a checkbox. Without this, clicking the
      // label fires once for the label and again for the forwarded checkbox
      // click — toggling the meal twice and leaving the selection unchanged.
      e.preventDefault();
      toggleMealSelection(card.dataset.id);
    });
  });
}

function mealCardHtml(meal) {
  const selected = state.selectedMealIds.includes(meal.id);
  return `
    <label class="sub-meal ${selected ? 'is-selected' : ''}" data-id="${escapeHtml(meal.id)}">
      <input type="checkbox" ${selected ? 'checked' : ''} />
      <div class="sub-meal__image-wrap">
        ${meal.image_url
          ? `<img src="${escapeHtml(meal.image_url)}" alt="${escapeHtml(meal.name)}" loading="lazy" onerror="this.style.display='none'" />`
          : ''}
      </div>
      <div class="sub-meal__body">
        <p class="sub-meal__name">${escapeHtml(meal.name)}</p>
        <p class="sub-meal__macro">${meal.kcal ?? '—'} kcal · ${meal.protein_g ?? 0}g protein</p>
      </div>
    </label>
  `;
}

function toggleMealSelection(id) {
  const i = state.selectedMealIds.indexOf(id);
  if (i >= 0) {
    state.selectedMealIds.splice(i, 1);
  } else {
    if (state.selectedMealIds.length >= state.mealsPerWeek) {
      // Swap out the oldest to keep within the cap
      state.selectedMealIds.shift();
    }
    state.selectedMealIds.push(id);
  }
  renderStepPickMeals();
}

function renderStepConfirm() {
  const planName = PLANS[state.plan].name;
  const day = COLLECTION_DAYS.find((d) => d.value === state.collectionDay)?.label || state.collectionDay;
  const time = TIME_SLOTS.find((t) => t.value === state.collectionTime)?.label || state.collectionTime;
  const chosen = state.selectedMealIds
    .map((id) => state.meals.find((m) => m.id === id)?.name)
    .filter(Boolean);

  contentEl.innerHTML = `
    <h2 class="wizard__title">${state.editId ? 'Save changes?' : 'Confirm your subscription'}</h2>
    <p class="wizard__subtitle">
      ${state.editId
        ? 'Review the updated details below before saving.'
        : 'Review your subscription details. You can pause, edit, or cancel anytime from your account.'}
    </p>
    <dl class="confirm-summary">
      <div><dt>Plan</dt><dd>${escapeHtml(planName)}</dd></div>
      <div><dt>Meals / week</dt><dd>${state.mealsPerWeek}</dd></div>
      <div><dt>Collection</dt><dd>${escapeHtml(day)}, ${escapeHtml(time)}</dd></div>
      <div><dt>Discount</dt><dd>10% off every delivery</dd></div>
    </dl>
    ${chosen.length ? `
      <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--cream-muted);">
        <strong style="color: var(--gold);">Your meals:</strong> ${chosen.map(escapeHtml).join(', ')}
      </p>
    ` : ''}
    <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--muted);">
      ${state.editId
        ? ''
        : 'We collect payment in person on collection. No card needed now.'}
    </p>
  `;
}

// ---------- VALIDATION ----------

function canAdvance() {
  switch (state.step) {
    case 1: return !!state.plan;
    case 2: return !!state.mealsPerWeek;
    case 3: return !!state.collectionDay && !!state.collectionTime;
    case 4:
      if (PLANS[state.plan].pickMeals) {
        return state.selectedMealIds.length === state.mealsPerWeek;
      }
      return true;
    case 5: return true;
    default: return false;
  }
}

function nextStep() {
  if (!canAdvance()) {
    if (state.step === 4 && PLANS[state.plan].pickMeals) {
      showError(`Pick exactly ${state.mealsPerWeek} meals (you have ${state.selectedMealIds.length}).`);
    } else {
      showError('Pick an option to continue.');
    }
    return;
  }

  // On final step: submit
  if (state.step === totalSteps()) {
    submitSubscription();
    return;
  }

  state.step++;
  renderStep();
}

function prevStep() {
  if (state.step <= 1) return;
  // When editing, can't go back to step 1
  if (state.editId && state.step === 2) return;
  state.step--;
  renderStep();
}

// ---------- SUBMIT ----------

async function submitSubscription() {
  hideError();

  // Make sure we're authed
  const session = await getSession();
  if (!session) {
    // Stash state then bounce through login
    sessionStorage.setItem('dd_sub_wizard', JSON.stringify({
      plan: state.plan,
      mealsPerWeek: state.mealsPerWeek,
      collectionDay: state.collectionDay,
      collectionTime: state.collectionTime,
      selectedMealIds: state.selectedMealIds,
      editId: state.editId,
      step: state.step
    }));
    window.location.href = 'login.html?redirect=subscriptions.html';
    return;
  }

  setSubmitting(true);

  const payload = {
    customer_id:       session.user.id,
    plan_type:         state.plan,
    meals_per_week:    state.mealsPerWeek,
    selected_meal_ids: state.selectedMealIds,
    collection_day:    state.collectionDay,
    collection_time:   state.collectionTime,
    status:            'active',
    discount_percent:  10
  };

  let error;
  if (state.editId) {
    // Drop fields RLS won't accept on update (discount_percent locked)
    const { discount_percent, customer_id, plan_type, ...updates } = payload;
    ({ error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', state.editId));
  } else {
    ({ error } = await supabase.from('subscriptions').insert(payload));
  }

  setSubmitting(false);

  if (error) {
    console.error('[subscriptions] submit', error);
    showError(error.message || 'Could not save subscription.');
    return;
  }

  sessionStorage.removeItem('dd_sub_wizard');
  toast(state.editId ? 'Subscription updated.' : 'You\'re subscribed!', 'success');
  setTimeout(() => {
    window.location.href = 'account.html?tab=subscriptions';
  }, 700);
}

function setSubmitting(on) {
  if (!nextBtn) return;
  nextBtn.disabled = on;
  nextBtn.textContent = on ? 'Saving…' : (state.editId ? 'Save Changes' : 'Subscribe');
}

// ---------- WIZARD OPEN/CLOSE ----------

async function openWizard({ plan, editId } = {}) {
  // Ensure user is signed in before opening (cleaner UX than mid-flow redirect)
  const session = await getSession();
  if (!session) {
    window.location.href = `login.html?redirect=${encodeURIComponent(
      'subscriptions.html' + (plan ? `?plan=${plan}` : '')
    )}`;
    return;
  }

  // Load meals once
  if (state.meals.length === 0) {
    const { data, error } = await supabase
      .from('meals')
      .select('id, slug, name, kcal, protein_g, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) {
      toast('Could not load meals.', 'error');
      return;
    }
    state.meals = data || [];
  }

  // Reset state (unless editing)
  if (editId) {
    state.editId = editId;
    await loadExisting(editId);
    state.step = 2;
  } else {
    state.editId = null;
    state.step = 1;
    state.plan = plan || null;
    state.mealsPerWeek = 5;
    state.collectionDay = 'monday';
    state.collectionTime = '17:00';
    state.selectedMealIds = [];
  }

  renderStep();
  if (modal && !modal.open) modal.showModal();
}

async function loadExisting(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    toast('Could not load that subscription.', 'error');
    return;
  }
  state.plan            = data.plan_type;
  state.mealsPerWeek    = data.meals_per_week;
  state.collectionDay   = data.collection_day || 'monday';
  state.collectionTime  = data.collection_time || '17:00';
  state.selectedMealIds = data.selected_meal_ids || [];
}

function closeWizard() {
  if (modal && modal.open) modal.close();
}

// ---------- HELPERS ----------

function showError(msg) {
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
}
function hideError() {
  if (errorEl) errorEl.hidden = true;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- INIT ----------

// Wire plan card "Choose this plan" buttons (live on the page below the hero).
document.querySelectorAll('[data-plan-card]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.planCard;
    openWizard({ plan });
  });
});

// Wizard controls
nextBtn?.addEventListener('click', nextStep);
backBtn?.addEventListener('click', prevStep);
closeBtn?.addEventListener('click', closeWizard);

// Restore wizard state if we came back from login
(async function restoreState() {
  const raw = sessionStorage.getItem('dd_sub_wizard');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    sessionStorage.removeItem('dd_sub_wizard');
    state.plan            = saved.plan;
    state.mealsPerWeek    = saved.mealsPerWeek;
    state.collectionDay   = saved.collectionDay;
    state.collectionTime  = saved.collectionTime;
    state.selectedMealIds = saved.selectedMealIds || [];
    state.editId          = saved.editId || null;
    state.step            = saved.step || 1;
    // Open wizard with restored state
    await openWizard({ plan: state.plan, editId: state.editId });
    // openWizard resets step / plan unless editing; re-apply
    if (saved.step) state.step = saved.step;
    renderStep();
  } catch (e) {
    console.warn('[subscriptions] restore failed', e);
  }
})();

// Honour ?edit= or ?plan= in the URL
(function fromUrl() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const plan = params.get('plan');
  if (editId) openWizard({ editId });
  else if (plan && PLANS[plan]) openWizard({ plan });
})();
