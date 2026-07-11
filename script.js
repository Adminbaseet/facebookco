const API = window.location.origin + '/api';
let currentUser = null;
let token = null;
let posts = [];
let selectedFile = null;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatar(firstname, lastname, bg) {
  const initials = getInitials(`${firstname} ${lastname}`);
  const color = bg || '1877f2';
  return `https://ui-avatars.com/api/?name=${initials}&background=${color}&color=fff&size=168`;
}

function populateDateFields() {
  const day = document.getElementById('reg-day');
  for (let i = 1; i <= 31; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i; day.appendChild(o); }
  const month = document.getElementById('reg-month');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  months.forEach((m, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = m; month.appendChild(o); });
  const year = document.getElementById('reg-year');
  for (let i = 2026; i >= 1905; i--) { const o = document.createElement('option'); o.value = i; o.textContent = i; year.appendChild(o); }
}
populateDateFields();

function showRegister() { document.getElementById('register-modal').style.display = 'flex'; }
function hideRegister() { document.getElementById('register-modal').style.display = 'none'; }

async function handleRegister() {
  const firstname = document.getElementById('reg-firstname').value.trim();
  const lastname = document.getElementById('reg-lastname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const gender = document.querySelector('input[name="gender"]:checked')?.value || 'male';
  const day = document.getElementById('reg-day').value;
  const month = document.getElementById('reg-month').value;
  const year = document.getElementById('reg-year').value;
  if (!firstname || !lastname || !email || !password) { alert('All fields are required'); return; }

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstname, lastname, gender, day, month, year })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    token = data.token;
    currentUser = data.user;
    currentUser.friends = 0;
    if (!currentUser.avatar) currentUser.avatar = getAvatar(currentUser.firstname, currentUser.lastname, '42b72a');
    hideRegister();
    document.getElementById('register-form').reset();
    enterApp();
  } catch { alert('Connection error. Make sure the server is running.'); }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    token = data.token;
    currentUser = data.user;
    currentUser.friends = 128;
    if (!currentUser.avatar) currentUser.avatar = getAvatar(currentUser.firstname, currentUser.lastname, '1877f2');
    enterApp();
  } catch { alert('Connection error. Make sure the server is running.'); }
}

async function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  updateUserUI();
  await loadStories();
  await loadPosts();
  await loadFriendCount();
  await loadCoins();
  await renderSidebarContacts();
}

function handleLogout() {
  currentUser = null;
  token = null;
  posts = [];
  hideAllPages();
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('login-form').reset();
}

function updateUserUI() {
  const name = `${currentUser.firstname} ${currentUser.lastname}`;
  const avatar = currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2');
  document.getElementById('nav-username').textContent = currentUser.firstname;
  document.getElementById('nav-avatar').src = avatar;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').src = avatar;
  document.getElementById('post-avatar').src = avatar;
  document.getElementById('modal-avatar').src = avatar;
  document.getElementById('modal-name').textContent = name;
}

async function submitPost() {
  const text = document.getElementById('post-textarea').value.trim();
  if (!text && !selectedFile) return;

  let image = null;
  if (selectedFile) {
    image = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(selectedFile);
    });
  }

  try {
    const res = await fetch(`${API}/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, image })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    posts.unshift(data.post);
    document.getElementById('post-textarea').value = '';
    selectedFile = null;
    document.getElementById('post-preview').style.display = 'none';
    document.getElementById('preview-image').src = '';
    document.getElementById('post-modal').style.display = 'none';
    renderPosts();
  } catch { alert('Failed to create post.'); }
}

async function loadPosts() {
  try {
    const res = await fetch(`${API}/posts`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    posts = data.posts;
  } catch { posts = []; }
  renderPosts();
}

function renderPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  if (posts.length === 0) {
    container.innerHTML = '<div class="demo-notice"><strong>No posts yet.</strong> Create your first post above!</div>';
    return;
  }
  container.innerHTML = posts.map(p => {
    const likeIcon = p.liked ? 'fa-thumbs-up liked' : 'fa-thumbs-up';
    const likeText = p.liked ? 'Liked' : 'Like';
    const commentsHtml = p.comments.map(c => `
      <div class="comment-item">
        <img src="${c.avatar || getAvatar(c.author.split(' ')[0] || 'U', c.author.split(' ')[1] || 'U', '1877f2')}" alt="">
        <div class="comment-bubble"><strong>${c.author}</strong><p>${c.text}</p></div>
      </div>`).join('');
    return `
      <div class="post-card" data-id="${p.id}">
        <div class="post-header">
          <img src="${p.avatar || getAvatar('User', '', '1877f2')}" alt="">
          <div class="post-header-info">
            <strong>${p.author}</strong>
            <small>${p.time} · <i class="fas fa-globe"></i></small>
          </div>
          <i class="fas fa-ellipsis-h" onclick="alert('Post options coming soon!')"></i>
        </div>
        <div class="post-body">${p.text}</div>
        ${p.image ? (p.image.startsWith('data:video/') ? `<video src="${p.image}" class="post-image" controls></video>` : `<img src="${p.image}" class="post-image" alt="">`) : ''}
        <div class="post-stats">
          <span><i class="fas fa-thumbs-up"></i> ${p.likes}</span>
          <span>${p.comments.length} comments</span>
        </div>
        <div class="post-actions">
          <span class="like-btn" onclick="toggleLike(${p.id})"><i class="fas ${likeIcon}"></i> ${likeText}</span>
          <span onclick="focusComment(${p.id})"><i class="fas fa-comment"></i> Comment</span>
          <span onclick="alert('Share feature coming soon!')"><i class="fas fa-share"></i> Share</span>
        </div>
        <div class="comment-section">
          ${commentsHtml}
          <div class="comment-input">
            <img src="${currentUser ? (currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2')) : getAvatar('U', 'U', '1877f2')}" alt="">
            <input type="text" placeholder="Write a comment..." onkeypress="if(event.key==='Enter')addComment(${p.id}, this)">
          </div>
        </div>
      </div>`;
  }).join('');
}

async function toggleLike(postId) {
  try {
    const res = await fetch(`${API}/posts/${postId}/like`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const post = posts.find(p => p.id === postId);
    if (post) { post.liked = data.liked; post.likes = data.likes; }
    renderPosts();
  } catch {}
}

async function addComment(postId, input) {
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${API}/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) return;
    const post = posts.find(p => p.id === postId);
    if (post) post.comments.push(data.comment);
    input.value = '';
    renderPosts();
  } catch {}
}

function focusComment(postId) {
  const card = document.querySelector(`.post-card[data-id="${postId}"]`);
  if (card) { const inp = card.querySelector('.comment-input input'); if (inp) inp.focus(); }
}

function showProfile() {
  hideAllPages();
  document.getElementById('profile-page').style.display = 'block';
  const avatar = currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2');
  document.getElementById('profile-name').textContent = `${currentUser.firstname} ${currentUser.lastname}`;
  document.getElementById('profile-avatar').src = avatar;
  try { loadFriendCount(); } catch(e) {}
}

function showFeed() {
  hideAllPages();
  document.querySelector('.main-layout').style.display = 'flex';
  try { document.querySelector('#post-modal .post-submit').onclick = submitPost; } catch(e) {}
}

/* ========== SETTINGS ========== */
function showSettings() {
  hideAllPages();
  document.getElementById('settings-page').style.display = 'block';
  document.querySelectorAll('#settings-page .friends-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('#settings-page .friends-tab').classList.add('active');
  showAccountSettings();
}

function switchSettingsTab(tab, btn) {
  document.querySelectorAll('#settings-page .friends-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'account') showAccountSettings();
  else if (tab === 'security') showSecuritySettings();
  else if (tab === 'privacy') showPrivacySettings();
  else if (tab === 'help') showHelpSettings();
  else if (tab === 'about') showAboutSettings();
}

function showAccountSettings() {
  const avatar = currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '65676b');
  document.getElementById('settings-content').innerHTML = `
    <div class="create-post">
      <h3 style="margin-bottom:16px"><i class="fas fa-user"></i> Account</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:16px">
          <img src="${avatar}" id="settings-avatar" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--card-bg);box-shadow:var(--shadow)">
          <div>
            <strong style="font-size:18px">${currentUser.firstname} ${currentUser.lastname}</strong>
            <p style="color:var(--text-secondary);font-size:13px">${currentUser.email}</p>
          </div>
        </div>
        <div class="name-row">
          <div class="input-group"><input type="text" id="settings-firstname" value="${currentUser.firstname}" placeholder="First name"></div>
          <div class="input-group"><input type="text" id="settings-lastname" value="${currentUser.lastname}" placeholder="Last name"></div>
        </div>
        <div class="input-group"><input type="text" id="settings-avatar-url" value="${currentUser.avatar || ''}" placeholder="Avatar URL (paste image link)"></div>
        <button class="post-submit" onclick="saveAccountSettings()">Save Changes</button>
      </div>
    </div>`;
}

async function saveAccountSettings() {
  const firstname = document.getElementById('settings-firstname').value.trim();
  const lastname = document.getElementById('settings-lastname').value.trim();
  const avatar = document.getElementById('settings-avatar-url').value.trim();
  if (!firstname || !lastname) { alert('Name fields are required'); return; }
  try {
    const res = await fetch(`${API}/auth/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ firstname, lastname, avatar: avatar || '' })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    currentUser = data.user;
    updateUserUI();
    showAccountSettings();
    alert('Profile updated!');
  } catch { alert('Failed to save settings.'); }
}

function showSecuritySettings() {
  document.getElementById('settings-content').innerHTML = `
    <div class="create-post">
      <h3 style="margin-bottom:16px"><i class="fas fa-lock"></i> Security</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><input type="password" id="settings-current-pw" placeholder="Current password"></div>
        <div class="input-group"><input type="password" id="settings-new-pw" placeholder="New password (min 6 characters)"></div>
        <div class="input-group"><input type="password" id="settings-confirm-pw" placeholder="Confirm new password"></div>
        <button class="post-submit" onclick="changePassword()">Change Password</button>
      </div>
    </div>`;
}

async function changePassword() {
  const current = document.getElementById('settings-current-pw').value;
  const newPw = document.getElementById('settings-new-pw').value;
  const confirm = document.getElementById('settings-confirm-pw').value;
  if (!current || !newPw || !confirm) { alert('All fields are required'); return; }
  if (newPw.length < 6) { alert('Password must be at least 6 characters'); return; }
  if (newPw !== confirm) { alert('Passwords do not match'); return; }
  try {
    const res = await fetch(`${API}/auth/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ current_password: current, new_password: newPw })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    alert('Password changed!');
    showSecuritySettings();
  } catch { alert('Failed to change password.'); }
}

function showPrivacySettings() {
  document.getElementById('settings-content').innerHTML = `
    <div class="create-post">
      <h3 style="margin-bottom:16px"><i class="fas fa-eye"></i> Privacy</h3>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>Who can send you friend requests</strong><p style="color:var(--text-secondary);font-size:13px">Everyone or friends of friends</p></div>
          <select id="privacy-friend-requests" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:14px">
            <option value="everyone">Everyone</option>
            <option value="friends_of_friends">Friends of friends</option>
          </select>
        </div>
      </div>
    </div>
    <div class="create-post" style="margin-top:12px">
      <h3 style="margin-bottom:12px"><i class="fas fa-shield-alt"></i> Data</h3>
      <p style="color:var(--text-secondary);font-size:14px">Your data is stored locally and is not shared with third parties.</p>
    </div>`;
}

function showHelpSettings() {
  document.getElementById('settings-content').innerHTML = `
    <div class="create-post">
      <h3 style="margin-bottom:12px"><i class="fas fa-question-circle"></i> Help & Support</h3>
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">
        Need help with facebook co? Here are some resources:<br><br>
        <span style="cursor:pointer;color:var(--primary)" onclick="alert('Report a problem form coming soon!')">📧 Report a Problem</span><br>
        <span style="cursor:pointer;color:var(--primary)" onclick="alert('FAQ page coming soon!')">❓ FAQ</span><br>
        <span style="cursor:pointer;color:var(--primary)" onclick="alert('Community guidelines coming soon!')">📋 Community Guidelines</span>
      </p>
    </div>
    <div class="friend-card" style="margin-top:12px;cursor:pointer" onclick="handleLogout()">
      <div style="width:48px;height:48px;border-radius:50%;background:#e41e3f;display:flex;align-items:center;justify-content:center;color:white;font-size:20px"><i class="fas fa-sign-out-alt"></i></div>
      <div class="friend-info">
        <strong style="color:#e41e3f">Log Out</strong>
        <small>Sign out of your account</small>
      </div>
    </div>`;
}

function showAboutSettings() {
  document.getElementById('settings-content').innerHTML = `
    <div class="create-post">
      <h3 style="margin-bottom:12px"><i class="fas fa-info-circle"></i> About</h3>
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">
        <strong style="color:var(--text)">facebook co</strong> — a social network built for everyone.<br><br>
        Version 8.0<br>
        Built with Node.js, Express, SQLite, and vanilla JavaScript.<br><br>
        &copy; 2026 facebook co. All rights reserved.
      </p>
    </div>`;
}

function toggleProfileMenu() {
  const notif = document.getElementById('notif-dropdown');
  const msg = document.getElementById('messenger-panel');
  if (notif.style.display !== 'none') notif.style.display = 'none';
  if (msg.style.display !== 'none') msg.style.display = 'none';
}

function toggleNotifications() {
  const el = document.getElementById('notif-dropdown');
  const msg = document.getElementById('messenger-panel');
  msg.style.display = 'none';
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ========== MESSENGER / CHAT ==========
let chatContacts = [];
let chatPollInterval = null;
let activeChatUserId = null;

function openMessenger() {
  const panel = document.getElementById('messenger-panel');
  const overlay = document.getElementById('messenger-overlay');
  panel.style.display = 'flex';
  overlay.style.display = 'block';
  document.getElementById('msg-badge').style.display = 'none';
  showChatContacts();
  startChatPolling();
}

function closeMessenger() {
  const panel = document.getElementById('messenger-panel');
  const overlay = document.getElementById('messenger-overlay');
  panel.style.display = 'none';
  overlay.style.display = 'none';
  stopChatPolling();
}

function startChatPolling() {
  stopChatPolling();
  chatPollInterval = setInterval(pollChat, 3000);
}

function stopChatPolling() {
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

async function pollChat() {
  if (activeChatUserId) {
    await loadMessages(activeChatUserId, true);
  }
  await loadChatContacts(true);
}

async function loadChatContacts(silent) {
  if (!currentUser || !token) return;
  try {
    const res = await fetch(`${API}/chat/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const conversations = data.conversations || [];
    chatContacts = conversations;
    if (!silent || document.getElementById('mp-contacts').style.display !== 'none') {
      renderChatContacts(conversations);
    }
    updateOnlineCount();
  } catch {}
}

async function renderChatContacts(conversations) {
  const container = document.getElementById('mp-contacts');
  const searchVal = (document.getElementById('mp-search-input').value || '').toLowerCase();

  const combined = conversations.filter(c => c.with_user).map(c => ({
    id: c.with_user.id,
    name: `${c.with_user.firstname} ${c.with_user.lastname}`,
    avatar: c.with_user.avatar,
    preview: c.last_message ? c.last_message.text : 'Start a conversation'
  }));

  const filtered = combined.filter(c => c.name.toLowerCase().includes(searchVal));

  if (filtered.length === 0) {
    container.innerHTML = '<div class="mp-empty">No friends yet. Add friends from the Friends page!</div>';
  } else {
    container.innerHTML = filtered.map(c => {
      const initials = getInitials(c.name);
      const avatar = c.avatar || getAvatar(c.name.split(' ')[0] || 'U', c.name.split(' ')[1] || 'U', '1877f2');
      return `<div class="mp-contact-item" onclick="openChat(${c.id})">
        <div class="mp-contact-avatar" style="background:linear-gradient(135deg,#1877f2,#42b72a)">
          <img src="${avatar}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">
          <span style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px">${initials}</span>
        </div>
        <div class="mp-contact-info">
          <div class="mp-contact-name">${c.name}</div>
          <div class="mp-contact-preview">${c.preview}</div>
        </div>
      </div>`;
    }).join('');
  }
  container.style.display = 'block';
}
  }
  container.innerHTML = html;
  container.style.display = 'block';
}

function filterChatContacts(val) {
  renderChatContacts(chatContacts);
}

async function loadOtherUsers() {
  if (!currentUser || !token) return [];
  try {
    const res = await fetch(`${API}/chat/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.users || [];
  } catch { return []; }
}

async function openChat(userId) {
  activeChatUserId = userId;
  document.getElementById('mp-contacts').style.display = 'none';
  document.getElementById('mp-chat-view').style.display = 'flex';

  const otherUser = chatContacts.find(c => c.with_user?.id === userId)?.with_user;
  if (!otherUser) {
    const users = await loadOtherUsers();
    const u = users.find(u => u.id === userId);
    if (!u) return;
    document.getElementById('mp-chat-user-info').innerHTML = `
      <img src="${u.avatar || getAvatar(u.firstname, u.lastname, '1877f2')}" alt="">
      <strong>${u.firstname} ${u.lastname}</strong>`;
    // Create conversation
    try {
      await fetch(`${API}/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId })
      });
    } catch {}
  } else {
    document.getElementById('mp-chat-user-info').innerHTML = `
      <img src="${otherUser.avatar || getAvatar(otherUser.firstname, otherUser.lastname, '1877f2')}" alt="">
      <strong>${otherUser.firstname} ${otherUser.lastname}</strong>`;
  }

  document.getElementById('mp-input').focus();
  await loadMessages(userId);
}

async function loadMessages(userId, silent) {
  const conv = chatContacts.find(c => c.with_user?.id === userId);
  if (!conv) return;
  try {
    const res = await fetch(`${API}/chat/conversations/${conv.id}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const msgs = data.messages || [];
    renderMessages(msgs);
  } catch {}
}

function renderMessages(messages) {
  const container = document.getElementById('mp-messages');
  if (messages.length === 0) {
    container.innerHTML = '<div class="mp-empty" style="padding:40px 0">No messages yet. Say hello!</div>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const isSent = m.sender_id === currentUser.id;
    return `<div class="mp-msg ${isSent ? 'sent' : 'received'}">
      ${m.text}
      <div class="mp-msg-time">${formatMsgTime(m.created_at)}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function formatMsgTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function sendMessage() {
  const input = document.getElementById('mp-input');
  const text = input.value.trim();
  if (!text || !activeChatUserId) return;
  input.value = '';

  let conv = chatContacts.find(c => c.with_user?.id === activeChatUserId);
  if (!conv) {
    try {
      const res = await fetch(`${API}/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: activeChatUserId })
      });
      const data = await res.json();
      conv = data.conversation;
      chatContacts.push(conv);
    } catch { return; }
  }

  try {
    const res = await fetch(`${API}/chat/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.message) {
      const msgs = document.getElementById('mp-messages');
      msgs.innerHTML += `<div class="mp-msg sent">${text}<div class="mp-msg-time">now</div></div>`;
      msgs.scrollTop = msgs.scrollHeight;
      await loadChatContacts(true);
    }
  } catch {}
}

function showChatContacts() {
  activeChatUserId = null;
  document.getElementById('mp-contacts').style.display = 'block';
  document.getElementById('mp-chat-view').style.display = 'none';
  loadChatContacts();
}

function updateOnlineCount() {
  const count = chatContacts.length;
  document.getElementById('mp-online-count').textContent = count > 0 ? `${count} active` : '';
}

async function renderSidebarContacts() {
  const container = document.getElementById('sidebar-contacts');
  if (!container || !token) return;
  try {
    const friends = await loadFriendList();
    const users = friends.slice(0, 8);
    if (users.length === 0) {
      container.innerHTML = '<div class="contact-item" style="cursor:default;color:var(--text-secondary);font-size:13px">Add friends to see them here</div>';
      return;
    }
    container.innerHTML = users.map(u => {
      const initials = getInitials(`${u.firstname} ${u.lastname}`);
      const colors = ['667eea','f5576c','43e97b','f7b928','a29bfe','1877f2','42b72a','e74c3c'];
      const color = colors[u.id % colors.length];
      return `<div class="contact-item" onclick="openMessenger();setTimeout(()=>openChat(${u.id}),100)">
        <span class="online-dot"></span>
        <div class="contact-avatar" style="background:${color}">${initials}</div>
        ${u.firstname} ${u.lastname}
      </div>`;
    }).join('');
  } catch {}
}

async function loadFriendList() {
  if (!token) return [];
  try {
    const res = await fetch(`${API}/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    return data.friends || [];
  } catch { return []; }
}

/* ========== FRIENDS ========== */
async function showFriends() {
  hideAllPages();
  document.getElementById('friends-page').style.display = 'block';
  document.getElementById('friends-content').innerHTML = '<div class="friends-loading">Loading...</div>';
  await loadFriends();
}

function switchFriendsTab(tab, btn) {
  document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'all') loadFriends();
  else if (tab === 'requests') loadRequests();
  else if (tab === 'suggestions') loadSuggestions();
}

async function loadFriends() {
  try {
    const res = await fetch(`${API}/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const friends = data.friends || [];
    if (friends.length === 0) {
      document.getElementById('friends-content').innerHTML = '<div class="friends-loading">No friends yet. Check the Suggestions tab!</div>';
    } else {
      document.getElementById('friends-content').innerHTML = friends.map(f => `
        <div class="friend-card">
          <img src="${f.avatar || getAvatar(f.firstname, f.lastname, '1877f2')}" alt="">
          <div class="friend-info">
            <strong onclick="alert('Profile page for friends coming soon!')">${f.firstname} ${f.lastname}</strong>
          </div>
          <div class="friend-actions">
            <button class="friend-btn danger" onclick="unfriend(${f.id})">Unfriend</button>
          </div>
        </div>`).join('');
    }
  } catch { document.getElementById('friends-content').innerHTML = '<div class="friends-loading">Error loading friends.</div>'; }
}

async function loadRequests() {
  try {
    const res = await fetch(`${API}/friends/requests`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const requests = data.requests || [];
    const badge = document.getElementById('requests-badge');
    if (requests.length > 0) { badge.textContent = requests.length; badge.style.display = 'inline'; }
    else { badge.style.display = 'none'; }

    if (requests.length === 0) {
      document.getElementById('friends-content').innerHTML = '<div class="friends-loading">No pending requests.</div>';
    } else {
      document.getElementById('friends-content').innerHTML = requests.map(f => `
        <div class="friend-card">
          <img src="${f.avatar || getAvatar(f.firstname, f.lastname, '1877f2')}" alt="">
          <div class="friend-info">
            <strong>${f.firstname} ${f.lastname}</strong>
            <small>Sent you a friend request</small>
          </div>
          <div class="friend-actions">
            <button class="friend-btn primary" onclick="acceptRequest(${f.id})">Accept</button>
            <button class="friend-btn secondary" onclick="rejectRequest(${f.id})">Reject</button>
          </div>
        </div>`).join('');
    }
  } catch { document.getElementById('friends-content').innerHTML = '<div class="friends-loading">Error loading requests.</div>'; }
}

async function loadSuggestions() {
  try {
    const res = await fetch(`${API}/friends/suggestions`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) {
      document.getElementById('friends-content').innerHTML = '<div class="friends-loading">No suggestions right now.</div>';
    } else {
      document.getElementById('friends-content').innerHTML = suggestions.map(f => `
        <div class="friend-card">
          <img src="${f.avatar || getAvatar(f.firstname, f.lastname, '1877f2')}" alt="">
          <div class="friend-info">
            <strong>${f.firstname} ${f.lastname}</strong>
          </div>
          <div class="friend-actions">
            <button class="friend-btn primary" onclick="sendFriendRequest(${f.id})">Add Friend</button>
          </div>
        </div>`).join('');
    }
  } catch { document.getElementById('friends-content').innerHTML = '<div class="friends-loading">Error loading suggestions.</div>'; }
}

async function sendFriendRequest(userId) {
  try {
    const res = await fetch(`${API}/friends/request/${userId}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) { alert('Friend request sent!'); loadSuggestions(); }
    else alert(data.error);
  } catch { alert('Failed to send request.'); }
}

async function acceptRequest(userId) {
  try {
    await fetch(`${API}/friends/accept/${userId}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    loadRequests();
    await loadFriends();
  } catch { alert('Failed to accept.'); }
}

async function rejectRequest(userId) {
  try {
    await fetch(`${API}/friends/reject/${userId}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
    });
    loadRequests();
  } catch { alert('Failed to reject.'); }
}

async function unfriend(userId) {
  if (!confirm('Unfriend this person?')) return;
  try {
    await fetch(`${API}/friends/${userId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    loadFriends();
  } catch { alert('Failed to unfriend.'); }
}

async function loadFriendCount() {
  try {
    const res = await fetch(`${API}/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const count = (data.friends || []).length;
    document.getElementById('profile-friends-count').textContent = `${count} friends`;
  } catch {}
}

/* ========== GROUPS ========== */
async function showGroups() {
  hideAllPages();
  document.getElementById('groups-page').style.display = 'block';
  document.getElementById('group-detail-page').style.display = 'none';
  document.getElementById('groups-content').innerHTML = '<div class="friends-loading">Loading...</div>';
  try { await loadMyGroups(); } catch(e) { document.getElementById('groups-content').innerHTML = '<div class="friends-loading">Error: ' + e.message + '</div>'; }
}

function hideAllPages() {
  document.querySelector('.main-layout').style.display = 'none';
  document.getElementById('profile-page').style.display = 'none';
  document.getElementById('friends-page').style.display = 'none';
  document.getElementById('groups-page').style.display = 'none';
  document.getElementById('group-detail-page').style.display = 'none';
  document.getElementById('settings-page').style.display = 'none';
}

function switchGroupsTab(tab, btn) {
  document.querySelectorAll('#groups-page .friends-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'my') loadMyGroups();
  else if (tab === 'discover') discoverGroups();
}

async function loadMyGroups() {
  try {
    const res = await fetch(`${API}/groups`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const groups = data.groups || [];
    if (groups.length === 0) {
      document.getElementById('groups-content').innerHTML = '<div class="friends-loading">You haven\'t joined any groups yet. Discover some!</div>';
    } else {
      document.getElementById('groups-content').innerHTML = groups.map(g => `
        <div class="group-card" onclick="openGroup(${g.id})">
          <div class="group-icon" style="background:linear-gradient(135deg,${g.id % 2 ? '#42b72a' : '#1877f2'},${g.id % 2 ? '#2ecc71' : '#1da1f2'})">
            <i class="fas fa-users"></i>
          </div>
          <div class="group-info">
            <strong>${g.name}</strong>
            <small>${g.member_count} members</small>
          </div>
        </div>`).join('');
    }
  } catch { document.getElementById('groups-content').innerHTML = '<div class="friends-loading">Error loading groups.</div>'; }
}

async function discoverGroups() {
  try {
    const res = await fetch(`${API}/groups/all`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const groups = data.groups || [];
    if (groups.length === 0) {
      document.getElementById('groups-content').innerHTML = '<div class="friends-loading">No groups on facebook co yet. Create the first one!</div>';
    } else {
      document.getElementById('groups-content').innerHTML = groups.map(g => `
        <div class="group-card" onclick="openGroup(${g.id})">
          <div class="group-icon" style="background:linear-gradient(135deg,${g.id % 2 ? '#42b72a' : '#1877f2'},${g.id % 2 ? '#2ecc71' : '#1da1f2'})">
            <i class="fas fa-users"></i>
          </div>
          <div class="group-info">
            <strong>${g.name}</strong>
            <small>${g.member_count} members · ${g.is_member ? 'Joined' : 'Not joined'}</small>
          </div>
        </div>`).join('');
    }
  } catch { document.getElementById('groups-content').innerHTML = '<div class="friends-loading">Error loading groups.</div>'; }
}

function showCreateGroupModal() {
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-desc-input').value = '';
  document.getElementById('create-group-modal').style.display = 'flex';
}

async function createGroup() {
  const name = document.getElementById('group-name-input').value.trim();
  const description = document.getElementById('group-desc-input').value.trim();
  if (!name) { alert('Group name is required'); return; }
  try {
    const res = await fetch(`${API}/groups`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, description })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    document.getElementById('create-group-modal').style.display = 'none';
    alert('Group created!');
    await loadMyGroups();
  } catch { alert('Failed to create group.'); }
}

async function openGroup(groupId) {
  document.getElementById('groups-page').style.display = 'none';
  document.getElementById('group-detail-page').style.display = 'block';
  document.getElementById('group-detail-posts').innerHTML = '<div class="friends-loading">Loading group...</div>';

  try {
    const res = await fetch(`${API}/groups/${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const g = data.group;
    document.getElementById('group-detail-name').textContent = g.name;
    document.getElementById('group-detail-meta').textContent = `${g.member_count} members`;
    const joinBtn = document.getElementById('group-join-btn');
    if (g.is_member) {
      if (g.role === 'admin') { joinBtn.style.display = 'none'; }
      else { joinBtn.textContent = 'Leave'; joinBtn.className = 'friend-btn danger'; joinBtn.style.display = ''; }
    } else {
      joinBtn.textContent = 'Join Group'; joinBtn.className = 'friend-btn primary'; joinBtn.style.display = '';
    }
    window._activeGroupId = groupId;
    await loadGroupPosts(groupId);
  } catch {
    document.getElementById('group-detail-posts').innerHTML = '<div class="friends-loading">Error loading group.</div>';
  }
}

async function toggleGroupJoin() {
  const gid = window._activeGroupId;
  if (!gid) return;
  const btn = document.getElementById('group-join-btn');
  const isJoin = btn.textContent === 'Join Group';
  try {
    if (isJoin) {
      await fetch(`${API}/groups/${gid}/join`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      btn.textContent = 'Leave'; btn.className = 'friend-btn danger';
    } else {
      await fetch(`${API}/groups/${gid}/leave`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      btn.textContent = 'Join Group'; btn.className = 'friend-btn primary';
    }
    await openGroup(gid);
  } catch { alert('Failed to update membership.'); }
}

async function loadGroupPosts(groupId) {
  try {
    const res = await fetch(`${API}/groups/${groupId}/posts`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const gposts = data.posts || [];
    if (gposts.length === 0) {
      document.getElementById('group-detail-posts').innerHTML = '<div class="create-post"><div class="create-post-top"><div class="avatar-ring sm"><img src="' + (currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2')) + '" alt=""></div><div class="post-input-btn" onclick="openGroupPostModal(' + groupId + ')"><span>Write a group post...</span></div></div><div class="friends-loading">No posts in this group yet.</div></div>';
    } else {
      document.getElementById('group-detail-posts').innerHTML = '<div class="create-post"><div class="create-post-top"><div class="avatar-ring sm"><img src="' + (currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2')) + '" alt=""></div><div class="post-input-btn" onclick="openGroupPostModal(' + groupId + ')"><span>Write a group post...</span></div></div>' +
        gposts.map(p => {
          const likeIcon = p.liked ? 'fa-thumbs-up liked' : 'fa-thumbs-up';
          const likeText = p.liked ? 'Liked' : 'Like';
          const commentsHtml = p.comments.map(c => `
            <div class="comment-item">
              <img src="${c.avatar || getAvatar(c.author.split(' ')[0] || 'U', c.author.split(' ')[1] || 'U', '1877f2')}" alt="">
              <div class="comment-bubble"><strong>${c.author}</strong><p>${c.text}</p></div>
            </div>`).join('');
          return `<div class="post-card" data-id="${p.id}">
            <div class="post-header">
              <img src="${p.avatar || getAvatar('User', '', '1877f2')}" alt="">
              <div class="post-header-info">
                <strong>${p.author}</strong>
                <small>${p.time} · <i class="fas fa-globe"></i></small>
              </div>
              <i class="fas fa-ellipsis-h" onclick="alert('Post options coming soon!')"></i>
            </div>
            <div class="post-body">${p.text}</div>
            ${p.image ? (p.image.startsWith('data:video/') ? `<video src="${p.image}" class="post-image" controls></video>` : `<img src="${p.image}" class="post-image" alt="">`) : ''}
            <div class="post-stats">
              <span><i class="fas fa-thumbs-up"></i> ${p.likes}</span>
              <span>${p.comments.length} comments</span>
            </div>
            <div class="post-actions">
              <span class="like-btn" onclick="toggleGroupLike(${groupId}, ${p.id})"><i class="fas ${likeIcon}"></i> ${likeText}</span>
              <span onclick="focusGroupComment(${groupId}, ${p.id})"><i class="fas fa-comment"></i> Comment</span>
              <span onclick="alert('Share coming soon!')"><i class="fas fa-share"></i> Share</span>
            </div>
            <div class="comment-section">
              ${commentsHtml}
              <div class="comment-input">
                <img src="${currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2')}" alt="">
                <input type="text" placeholder="Write a comment..." onkeypress="if(event.key==='Enter')addGroupComment(${groupId}, ${p.id}, this)">
              </div>
            </div>
          </div>`;
        }).join('');
    }
  } catch {
    document.getElementById('group-detail-posts').innerHTML = '<div class="friends-loading">Error loading posts.</div>';
  }
}

async function toggleGroupLike(groupId, postId) {
  try {
    const res = await fetch(`${API}/posts/${postId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    await res.json();
    await loadGroupPosts(groupId);
  } catch {}
}

async function addGroupComment(groupId, postId, input) {
  const text = input.value.trim();
  if (!text) return;
  try {
    await fetch(`${API}/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text })
    });
    input.value = '';
    await loadGroupPosts(groupId);
  } catch {}
}

function focusGroupComment(groupId, postId) {
  const container = document.getElementById('group-detail-posts');
  const card = container.querySelector(`.post-card[data-id="${postId}"]`);
  if (card) { const inp = card.querySelector('.comment-input input'); if (inp) inp.focus(); }
}

function openGroupPostModal(groupId) {
  window._groupPostGroupId = groupId;
  selectedFile = null;
  document.getElementById('post-preview').style.display = 'none';
  document.getElementById('preview-image').src = '';
  document.getElementById('post-textarea').value = '';
  document.getElementById('post-modal').style.display = 'flex';
  const oldSubmit = document.querySelector('#post-modal .post-submit');
  oldSubmit.onclick = function() { submitGroupPost(); };
}

async function submitGroupPost() {
  const text = document.getElementById('post-textarea').value.trim();
  const groupId = window._groupPostGroupId;
  if (!text && !selectedFile) return;
  let image = null;
  if (selectedFile) {
    image = await new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsDataURL(selectedFile); });
  }
  try {
    const res = await fetch(`${API}/groups/${groupId}/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, image })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    document.getElementById('post-textarea').value = '';
    selectedFile = null;
    document.getElementById('post-preview').style.display = 'none';
    document.getElementById('preview-image').src = '';
    document.getElementById('post-modal').style.display = 'none';
    document.querySelector('#post-modal .post-submit').onclick = submitPost;
    await loadGroupPosts(groupId);
  } catch { alert('Failed to post.'); }
}

function switchNav(el) {
  document.querySelectorAll('.nav-icon').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

let darkMode = localStorage.getItem('fbco_mode') || 'system';
function applyMode(mode) {
  document.body.classList.remove('mode-light', 'mode-dark');
  if (mode === 'dark') {
    document.body.classList.add('mode-dark');
  } else if (mode === 'light') {
    document.body.classList.add('mode-light');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.add(prefersDark ? 'mode-dark' : 'mode-light');
  }
}
function updateModeUI() {
  const items = document.querySelectorAll('.sidebar-item');
  const el = items[items.length - 2];
  if (!el) return;
  if (darkMode === 'light') el.innerHTML = '<i class="fas fa-moon"></i> Dark';
  else if (darkMode === 'dark') el.innerHTML = '<i class="fas fa-desktop"></i> System';
  else el.innerHTML = '<i class="fas fa-sun"></i> Light';
}
function toggleDarkMode(el) {
  const cycle = { light: 'dark', dark: 'system', system: 'light' };
  darkMode = cycle[darkMode];
  localStorage.setItem('fbco_mode', darkMode);
  applyMode(darkMode);
  updateModeUI();
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (darkMode === 'system') applyMode('system');
});
(function initMode() {
  applyMode(darkMode);
  const items = document.querySelectorAll('.sidebar-item');
  const el = items[items.length - 2];
  if (el) updateModeUI();
})();

document.addEventListener('click', function(e) {
  const notif = document.getElementById('notif-dropdown');
  if (notif.style.display !== 'none' && !e.target.closest('#notif-dropdown') && !e.target.closest('[onclick*="toggleNotifications"]')) {
    notif.style.display = 'none';
  }
});

/* ========== STORIES ========== */
let storiesData = [];
let currentStoryIndex = 0;

async function loadStories() {
  try {
    const res = await fetch(`${API}/stories`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    storiesData = data.stories || [];
    renderStories();
  } catch { storiesData = []; renderStories(); }
}

function renderStories() {
  const container = document.getElementById('stories-row');
  let html = `<div class="story-card create-story" onclick="openStoryModal()">
    <div class="story-bg"></div>
    <div class="story-add"><i class="fas fa-plus"></i></div>
    <span>Create Story</span>
  </div>`;
  const seen = new Set();
  for (const s of storiesData) {
    if (seen.has(s.user_id)) continue;
    seen.add(s.user_id);
    const initials = getInitials(`${s.firstname} ${s.lastname}`);
    const bg = s.user_id % 2 ? '667eea,764ba2' : 'f093fb,f5576c';
    html += `<div class="story-card" onclick="openStoryViewer(${storiesData.indexOf(s)})">
      <img src="${s.avatar || getAvatar(s.firstname, s.lastname, '1877f2')}" alt="" class="story-author">
      <div class="story-bg" style="background:linear-gradient(45deg,${bg})"></div>
      <span>${s.firstname}</span>
    </div>`;
  }
  container.innerHTML = html;
}

function openStoryModal() {
  document.getElementById('story-modal-avatar').src = currentUser.avatar || getAvatar(currentUser.firstname, currentUser.lastname, '1877f2');
  document.getElementById('story-modal-name').textContent = `${currentUser.firstname} ${currentUser.lastname}`;
  document.getElementById('story-modal-preview').style.display = 'flex';
  document.getElementById('story-modal-placeholder').style.display = 'flex';
  document.getElementById('story-modal-media').style.display = 'none';
  document.getElementById('story-modal-media').innerHTML = '';
  document.getElementById('story-submit-btn').style.display = 'none';
  document.getElementById('story-file-input').value = '';
  document.getElementById('story-modal').style.display = 'flex';
}

function closeStoryModal() {
  document.getElementById('story-modal').style.display = 'none';
}

function pickStoryFile() {
  document.getElementById('story-file-input').click();
}

function handleStoryFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('story-modal-placeholder').style.display = 'none';
    const media = document.getElementById('story-modal-media');
    media.style.display = 'flex';
    if (file.type.startsWith('video/')) {
      media.innerHTML = `<video src="${e.target.result}" controls style="width:100%;max-height:400px;border-radius:8px"></video>`;
    } else {
      media.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:400px;object-fit:contain;border-radius:8px">`;
    }
    document.getElementById('story-submit-btn').style.display = 'block';
    window._storyMedia = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

async function submitStory() {
  const media = window._storyMedia;
  if (!media) return;
  try {
    const res = await fetch(`${API}/stories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ media })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    closeStoryModal();
    await loadStories();
  } catch { alert('Failed to create story.'); }
}

function openStoryViewer(index) {
  currentStoryIndex = index;
  showStory();
}

function showStory() {
  if (!storiesData.length || currentStoryIndex < 0 || currentStoryIndex >= storiesData.length) {
    closeStoryViewer();
    return;
  }
  const s = storiesData[currentStoryIndex];
  document.getElementById('story-viewer-avatar').src = s.avatar || getAvatar(s.firstname, s.lastname, '1877f2');
  document.getElementById('story-viewer-name').textContent = `${s.firstname} ${s.lastname}`;
  document.getElementById('story-viewer-time').textContent = timeAgo(s.created_at);
  const media = document.getElementById('story-viewer-media');
  if (s.media.startsWith('data:video')) {
    media.innerHTML = `<video src="${s.media}" controls autoplay style="width:100%;max-height:100%;border-radius:12px;object-fit:contain"></video>`;
  } else {
    media.innerHTML = `<img src="${s.media}" style="width:100%;max-height:100%;border-radius:12px;object-fit:contain">`;
  }
  document.getElementById('story-viewer').style.display = 'flex';
}

function nextStory() {
  if (currentStoryIndex < storiesData.length - 1) {
    currentStoryIndex++;
    showStory();
  } else {
    closeStoryViewer();
  }
}

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    showStory();
  }
}

function closeStoryViewer() {
  document.getElementById('story-viewer').style.display = 'none';
  document.getElementById('story-viewer-media').innerHTML = '';
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

/* ========== COINS & PREMIUM ========== */
async function loadCoins() {
  if (!token) return;
  try {
    const res = await fetch(`${API}/monetize/coins`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const el = document.getElementById('sidebar-coins');
    if (el) el.textContent = data.balance || 0;
    const d = document.getElementById('coins-display');
    if (d) d.textContent = data.balance || 0;
  } catch {}
}

async function loadPremiumStatus() {
  if (!token) return;
  try {
    const res = await fetch(`${API}/monetize/premium`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const el = document.getElementById('premium-status');
    if (el) {
      if (data.active) el.innerHTML = `✅ ${data.premium?.plan?.toUpperCase()} plan active`;
      else el.innerHTML = 'No active premium plan';
    }
  } catch {}
}

async function showCoinsModal() {
  document.getElementById('coins-modal').style.display = 'flex';
  await loadCoins();
  await loadPremiumStatus();
}

async function buyCoins(amount) {
  if (!confirm(`Buy ${amount} coins? (Mock payment — no real money charged)`)) return;
  try {
    const res = await fetch(`${API}/monetize/coins/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    await loadCoins();
    alert(`🎉 ${data.message}`);
  } catch { alert('Failed to buy coins.'); }
}

async function buyPremium(plan) {
  if (!confirm(`Activate ${plan.toUpperCase()} plan for ${plan === 'basic' ? '100' : '500'} coins?`)) return;
  try {
    const res = await fetch(`${API}/monetize/premium/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ plan })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    await loadCoins();
    await loadPremiumStatus();
    alert(`🎉 ${data.message}`);
  } catch { alert('Failed to buy premium.'); }
}

async function premiumBadgeHTML(userId) {
  if (!token) return '';
  try {
    const res = await fetch(`${API}/monetize/premium`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.active) return ' <i class="fas fa-crown premium-badge" style="color:#f7b928;font-size:14px" title="Premium"></i>';
  } catch {}
  return '';
}

function pickFile() {
  document.getElementById('file-input').click();
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('post-preview');
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      preview.innerHTML = `<video src="${e.target.result}" controls style="width:100%;max-height:300px;border-radius:12px;background:#000"></video>
        <button class="remove-preview" onclick="removePreview()">&times;</button>`;
    } else {
      const img = document.getElementById('preview-image');
      img.src = e.target.result;
    }
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removePreview() {
  selectedFile = null;
  const preview = document.getElementById('post-preview');
  preview.style.display = 'none';
  preview.innerHTML = '<img id="preview-image" src="" alt=""><button class="remove-preview" onclick="removePreview()">&times;</button>';
}

function openPostModal() {
  selectedFile = null;
  const preview = document.getElementById('post-preview');
  preview.style.display = 'none';
  preview.innerHTML = '<img id="preview-image" src="" alt=""><button class="remove-preview" onclick="removePreview()">&times;</button>';
  document.getElementById('post-modal').style.display = 'flex';
  document.querySelector('#post-modal .post-submit').onclick = submitPost;
}
