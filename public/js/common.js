const Auth = {
  token() { return localStorage.getItem('token'); },
  user() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },
  save(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/login.html';
  },
  require() {
    if (!this.token()) { location.href = '/login.html'; return false; }
    return true;
  }
};

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = 'application/json';
  const token = Auth.token();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function renderHeader() {
  const u = Auth.user();
  const header = document.querySelector('header nav');
  if (!header) return;
  if (u) {
    header.innerHTML = `
      <a href="/">Streams</a>
      ${u.role === 'creator' ? '<a href="/creator.html">Go Live</a>' : ''}
      <span class="muted" style="margin-left:16px">${u.username} (${u.role})</span>
      <a href="#" id="logoutBtn">Logout</a>
    `;
    document.getElementById('logoutBtn').onclick = (e) => { e.preventDefault(); Auth.logout(); };
  } else {
    header.innerHTML = `<a href="/login.html">Login</a><a href="/register.html">Register</a>`;
  }
}

document.addEventListener('DOMContentLoaded', renderHeader);
