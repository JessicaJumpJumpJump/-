const authView = document.getElementById('authView');
const mainView = document.getElementById('mainView');

const SLOT_LABELS = {
  baby_breakfast: '揪汪汪早餐',
  baby_dinner: '揪汪汪晚餐',
  adult_breakfast: '大人早餐',
  adult_dinner: '大人晚餐',
};

let currentUser = null;
let ingredients = [];
let currentDate = todayStr();

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '出错了');
  return data;
}

// ---------- Auth tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('loginForm').classList.toggle('hidden', btn.dataset.tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', btn.dataset.tab !== 'register');
  });
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';
  try {
    const { user } = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    onLoggedIn(user);
  } catch (err) {
    errBox.textContent = err.message;
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const password = document.getElementById('regPassword').value;
  const errBox = document.getElementById('registerError');
  errBox.textContent = '';
  try {
    const { user } = await api('/api/register', { method: 'POST', body: JSON.stringify({ username, displayName, password }) });
    onLoggedIn(user);
  } catch (err) {
    errBox.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  authView.classList.remove('hidden');
  mainView.classList.add('hidden');
});

function onLoggedIn(user) {
  currentUser = user;
  authView.classList.add('hidden');
  mainView.classList.remove('hidden');
  document.getElementById('whoAmI').textContent = `${user.avatar} ${user.display_name}`;
  init();
}

// ---------- Date picker ----------
const datePicker = document.getElementById('datePicker');
datePicker.value = currentDate;
datePicker.addEventListener('change', () => {
  currentDate = datePicker.value || todayStr();
  loadBoard();
});

// ---------- Ingredients ----------
document.getElementById('addIngredientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('ingName').value.trim();
  const category = document.getElementById('ingCategory').value;
  if (!name) return;
  await api('/api/ingredients', { method: 'POST', body: JSON.stringify({ name, category }) });
  document.getElementById('ingName').value = '';
  await loadIngredients();
});

async function loadIngredients() {
  const { ingredients: list } = await api('/api/ingredients');
  ingredients = list;
  renderIngredients();
}

function renderIngredients() {
  const box = document.getElementById('ingredientList');
  box.innerHTML = '';
  if (ingredients.length === 0) {
    box.innerHTML = '<div class="empty-msg">还没有食材，快去发布第一个吧！</div>';
    return;
  }
  for (const ing of ingredients) {
    const card = document.createElement('div');
    card.className = 'ing-card';
    card.draggable = true;
    card.dataset.id = ing.id;
    card.innerHTML = `
      <span class="emoji">${ing.emoji}</span>
      <span>
        <div class="name">${escapeHtml(ing.name)}</div>
        <div class="meta">${categoryLabel(ing.category)}</div>
      </span>
      <button class="del-btn" title="删除">✕</button>
    `;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(ing.id));
    });
    card.querySelector('.del-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`删除食材「${ing.name}」吗？`)) return;
      await api(`/api/ingredients/${ing.id}`, { method: 'DELETE' });
      await loadIngredients();
      await loadBoard();
    });
    box.appendChild(card);
  }
}

function categoryLabel(cat) {
  return { meat: '肉类', vegetable: '蔬菜', fruit: '水果', staple: '主食', dairy: '奶制品', other: '其它' }[cat] || '其它';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Board ----------
document.querySelectorAll('.slot-drop').forEach((zone) => {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const ingredientId = Number(e.dataTransfer.getData('text/plain'));
    if (!ingredientId) return;
    await api('/api/board', {
      method: 'POST',
      body: JSON.stringify({ date: currentDate, slot: zone.dataset.slot, ingredientId }),
    });
    await loadBoard();
  });
});

async function loadBoard() {
  const { items } = await api(`/api/board?date=${encodeURIComponent(currentDate)}`);
  document.querySelectorAll('.slot-drop').forEach((zone) => {
    const slot = zone.dataset.slot;
    const slotItems = items.filter((it) => it.slot === slot);
    zone.innerHTML = '';
    if (slotItems.length === 0) {
      zone.innerHTML = `<div class="empty-msg">拖一个食材到这里～</div>`;
      return;
    }
    for (const it of slotItems) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span class="emoji">${it.emoji}</span>
        <span>${escapeHtml(it.name)}</span>
        <span class="by">${it.added_by_name ? '· ' + escapeHtml(it.added_by_name) : ''}</span>
        <button class="rm" title="移除">✕</button>
      `;
      chip.querySelector('.rm').addEventListener('click', async () => {
        await api(`/api/board/${it.id}`, { method: 'DELETE' });
        await loadBoard();
      });
      zone.appendChild(chip);
    }
  });
}

async function init() {
  await loadIngredients();
  await loadBoard();
}

// ---------- Boot ----------
(async function boot() {
  try {
    const { user } = await api('/api/me');
    if (user) {
      onLoggedIn(user);
    } else {
      authView.classList.remove('hidden');
    }
  } catch (e) {
    authView.classList.remove('hidden');
  }
})();
