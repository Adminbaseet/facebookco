const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'facebookco.db');
let db = null;

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, firstname TEXT NOT NULL, lastname TEXT NOT NULL, gender TEXT DEFAULT "male", dob_day INTEGER DEFAULT 1, dob_month INTEGER DEFAULT 1, dob_year INTEGER DEFAULT 2000, avatar TEXT DEFAULT "", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, text TEXT DEFAULT "", image TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, UNIQUE(post_id, user_id), FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, status TEXT DEFAULT "pending", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(sender_id, receiver_id), FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (receiver_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS groups_table (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT "", cover_photo TEXT DEFAULT "", created_by INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT DEFAULT "member", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, user_id), FOREIGN KEY (group_id) REFERENCES groups_table(id), FOREIGN KEY (user_id) REFERENCES users(id))');
  try { db.run('ALTER TABLE posts ADD COLUMN group_id INTEGER DEFAULT NULL'); } catch {}
  db.run('CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS conversation_participants (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, user_id INTEGER NOT NULL, UNIQUE(conversation_id, user_id), FOREIGN KEY (conversation_id) REFERENCES conversations(id), FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (conversation_id) REFERENCES conversations(id), FOREIGN KEY (sender_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, media TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS coins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE NOT NULL, balance INTEGER DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, type TEXT DEFAULT "coins", status TEXT DEFAULT "completed", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS premium_memberships (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE NOT NULL, plan TEXT DEFAULT "basic", expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))');

  const s = db.prepare('SELECT id FROM users WHERE email = ?');
  s.bind(['demo@facebookco.com']);
  const hasDemo = s.step();
  s.free();
  if (!hasDemo) {
    const hash = bcrypt.hashSync('demo123', 10);
    db.run('INSERT INTO users (email, password, firstname, lastname, gender, dob_day, dob_month, dob_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['demo@facebookco.com', hash, 'Demo', 'User', 'male', 1, 1, 1990]);
    const uid = lastId();
    db.run('INSERT INTO posts (user_id, text) VALUES (?, ?)', [uid, 'Welcome to facebook co! 🎉 A brand new social network built for everyone. Start connecting with friends today.']);
    db.run('INSERT INTO posts (user_id, text) VALUES (?, ?)', [uid, 'What features would you like to see next? Let us know in the comments!']);
  }

  save();
}

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function queryOne(sql, params) {
  const s = db.prepare(sql);
  s.bind(params);
  const has = s.step();
  if (!has) { s.free(); return null; }
  const obj = s.getAsObject();
  s.free();
  return obj;
}

function queryAll(sql, params) {
  const s = db.prepare(sql);
  s.bind(params);
  const results = [];
  while (s.step()) results.push(s.getAsObject());
  s.free();
  return results;
}

function lastId() {
  const r = db.exec('SELECT last_insert_rowid() as id');
  return r[0].values[0][0];
}

const api = {
  init,
  run: (...args) => db.run(...args),
  save,
  lastId,
  queryAll,
  users: {
    findByEmail(email) { return queryOne('SELECT * FROM users WHERE email = ?', [email]); },
    findById(id) { return queryOne('SELECT * FROM users WHERE id = ?', [id]); },
    create(user) {
      db.run('INSERT INTO users (email, password, firstname, lastname, gender, dob_day, dob_month, dob_year, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [user.email, user.password, user.firstname, user.lastname, user.gender, user.dob_day, user.dob_month, user.dob_year, user.avatar || '']);
      const id = lastId();
      save();
      return this.findById(id);
    },
    update(id, fields) {
      const sets = []; const vals = [];
      for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = ?`); vals.push(v); }
      if (sets.length === 0) return null;
      vals.push(id);
      db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
      save();
      return this.findById(id);
    }
  },
  posts: {
    findAll() { return queryAll('SELECT * FROM posts ORDER BY created_at DESC'); },
    findFeed() { return queryAll('SELECT * FROM posts WHERE group_id IS NULL ORDER BY created_at DESC'); },
    findById(id) { return queryOne('SELECT * FROM posts WHERE id = ?', [id]); },
    create(post) {
      db.run('INSERT INTO posts (user_id, text, image) VALUES (?, ?, ?)', [post.user_id, post.text, post.image || null]);
      const id = lastId();
      save();
      return this.findById(id);
    },
    delete(id) {
      db.run('DELETE FROM comments WHERE post_id = ?', [id]);
      db.run('DELETE FROM likes WHERE post_id = ?', [id]);
      db.run('DELETE FROM posts WHERE id = ?', [id]);
      save();
    }
  },
  comments: {
    findByPost(postId) { return queryAll('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC', [postId]); },
    create(comment) {
      db.run('INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)', [comment.post_id, comment.user_id, comment.text]);
      const id = lastId();
      save();
      return { id, ...comment };
    }
  },
  likes: {
    find(postId, userId) { return queryOne('SELECT * FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]); },
    count(postId) {
      const r = queryOne('SELECT COUNT(*) as c FROM likes WHERE post_id = ?', [postId]);
      return r ? r.c : 0;
    },
    add(postId, userId) { db.run('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]); save(); },
    remove(postId, userId) { db.run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]); save(); }
  },
  friends: {
    request(senderId, receiverId) {
      db.run('INSERT OR IGNORE INTO friends (sender_id, receiver_id) VALUES (?, ?)', [senderId, receiverId]);
      save();
    },
    accept(senderId, receiverId) {
      db.run('UPDATE friends SET status = "accepted" WHERE sender_id = ? AND receiver_id = ?', [senderId, receiverId]);
      save();
    },
    reject(senderId, receiverId) {
      db.run('DELETE FROM friends WHERE sender_id = ? AND receiver_id = ?', [senderId, receiverId]);
      save();
    },
    remove(user1, user2) {
      db.run('DELETE FROM friends WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', [user1, user2, user2, user1]);
      save();
    },
    getFriends(userId) {
      return queryAll(
        'SELECT u.id, u.firstname, u.lastname, u.avatar FROM friends f JOIN users u ON (CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END) = u.id WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = "accepted"',
        [userId, userId, userId]
      );
    },
    getRequests(userId) {
      return queryAll(
        'SELECT u.id, u.firstname, u.lastname, u.avatar FROM friends f JOIN users u ON f.sender_id = u.id WHERE f.receiver_id = ? AND f.status = "pending"',
        [userId]
      );
    },
    getSentRequests(userId) {
      return queryAll(
        'SELECT u.id, u.firstname, u.lastname, u.avatar FROM friends f JOIN users u ON f.receiver_id = u.id WHERE f.sender_id = ? AND f.status = "pending"',
        [userId]
      );
    },
    getSuggestions(userId) {
      const friendIds = queryAll(
        'SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as fid FROM friends WHERE (sender_id = ? OR receiver_id = ?) AND status = "accepted"',
        [userId, userId, userId]
      ).map(r => r.fid);
      friendIds.push(userId);
      const placeholders = friendIds.map(() => '?').join(',');
      return queryAll(`SELECT id, firstname, lastname, avatar FROM users WHERE id NOT IN (${placeholders}) LIMIT 6`, friendIds);
    },
    getStatus(userId, otherId) {
      const r = queryOne(
        'SELECT * FROM friends WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
        [userId, otherId, otherId, userId]
      );
      if (!r) return 'none';
      if (r.status === 'accepted') return 'friends';
      if (r.sender_id === userId) return 'pending';
      return 'requested';
    },
    count(userId) {
      const r = queryOne(
        'SELECT COUNT(*) as c FROM friends WHERE (sender_id = ? OR receiver_id = ?) AND status = "accepted"',
        [userId, userId]
      );
      return r ? r.c : 0;
    }
  },
  groups: {
    create(group) {
      db.run('INSERT INTO groups_table (name, description, cover_photo, created_by) VALUES (?, ?, ?, ?)', [group.name, group.description || '', group.cover_photo || '', group.created_by]);
      const gid = lastId();
      save();
      db.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [gid, group.created_by, 'admin']);
      save();
      return this.findById(gid);
    },
    findById(id) { return queryOne('SELECT * FROM groups_table WHERE id = ?', [id]); },
    findForUser(userId) {
      return queryAll(
        'SELECT g.*, gm.role FROM groups_table g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY g.created_at DESC',
        [userId]
      );
    },
    search(query) {
      return queryAll('SELECT * FROM groups_table WHERE name LIKE ? LIMIT 20', [`%${query}%`]);
    },
    findAll() {
      return queryAll('SELECT * FROM groups_table ORDER BY created_at DESC LIMIT 50');
    },
    memberCount(groupId) {
      const r = queryOne('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?', [groupId]);
      return r ? r.c : 0;
    },
    isMember(groupId, userId) {
      return !!queryOne('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    },
    getMembers(groupId) {
      return queryAll(
        'SELECT u.id, u.firstname, u.lastname, u.avatar, gm.role FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?',
        [groupId]
      );
    },
    getRole(groupId, userId) {
      const r = queryOne('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
      return r ? r.role : null;
    },
    join(groupId, userId) {
      db.run('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
      save();
    },
    leave(groupId, userId) {
      db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
      save();
    }
  },
  conversations: {
    create(participantIds) {
      db.run('INSERT INTO conversations DEFAULT VALUES');
      const cid = lastId();
      save();
      for (const uid of participantIds) {
        db.run('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [cid, uid]);
      }
      save();
      return this.findById(cid);
    },
    findById(id) {
      const c = queryOne('SELECT * FROM conversations WHERE id = ?', [id]);
      if (!c) return null;
      const parts = queryAll('SELECT user_id FROM conversation_participants WHERE conversation_id = ?', [id]).map(p => p.user_id);
      const lm = queryOne('SELECT text, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', [id]);
      return { ...c, participants: parts, last_message: lm || null, last_activity: lm ? lm.created_at : c.created_at };
    },
    findByUser(userId) {
      const convs = queryAll(
        'SELECT c.* FROM conversations c JOIN conversation_participants cp ON c.id = cp.conversation_id WHERE cp.user_id = ? ORDER BY c.created_at DESC',
        [userId]
      );
      return convs.map(c => {
        const parts = queryAll('SELECT user_id FROM conversation_participants WHERE conversation_id = ?', [c.id]).map(p => p.user_id);
        const lm = queryOne('SELECT text, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', [c.id]);
        return { ...c, participants: parts, last_message: lm || null, last_activity: lm ? lm.created_at : c.created_at };
      });
    },
    findBetweenUsers(user1, user2) {
      const c1 = queryAll(
        'SELECT cp1.conversation_id FROM conversation_participants cp1 JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id WHERE cp1.user_id = ? AND cp2.user_id = ?',
        [user1, user2]
      );
      if (c1.length === 0) return null;
      return this.findById(c1[0].conversation_id);
    },
    updateLastMessage(convId, text, senderId) {
      const conv = queryOne('SELECT * FROM conversations WHERE id = ?', [convId]);
      if (conv) {
        db.run('UPDATE conversations SET created_at = CURRENT_TIMESTAMP WHERE id = ?', [convId]);
        save();
      }
    }
  },
  messages: {
    findByConversation(convId) {
      return queryAll('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [convId]);
    },
    create(msg) {
      db.run('INSERT INTO messages (conversation_id, sender_id, text) VALUES (?, ?, ?)', [msg.conversation_id, msg.sender_id, msg.text]);
      const id = lastId();
      save();
      return { id, ...msg };
    }
  },
  monetize: {
    getCoins(userId) {
      let r = queryOne('SELECT balance FROM coins WHERE user_id = ?', [userId]);
      if (!r) { db.run('INSERT OR IGNORE INTO coins (user_id, balance) VALUES (?, 0)', [userId]); save(); r = { balance: 0 }; }
      return r.balance;
    },
    addCoins(userId, amount) {
      db.run('INSERT INTO coins (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?', [userId, amount, amount]);
      save();
      return this.getCoins(userId);
    },
    spendCoins(userId, amount) {
      const bal = this.getCoins(userId);
      if (bal < amount) return false;
      db.run('UPDATE coins SET balance = balance - ? WHERE user_id = ?', [amount, userId]);
      save();
      return true;
    },
    recordPurchase(userId, amount, type) {
      db.run('INSERT INTO purchases (user_id, amount, type) VALUES (?, ?, ?)', [userId, amount, type || 'coins']);
      const id = lastId();
      save();
      return id;
    },
    getPremium(userId) {
      return queryOne('SELECT * FROM premium_memberships WHERE user_id = ?', [userId]);
    },
    setPremium(userId, plan, days) {
      const exp = new Date(Date.now() + days * 86400000).toISOString();
      db.run('INSERT INTO premium_memberships (user_id, plan, expires_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET plan = ?, expires_at = ?',
        [userId, plan, exp, plan, exp]);
      save();
      return this.getPremium(userId);
    },
    isPremium(userId) {
      const r = queryOne("SELECT * FROM premium_memberships WHERE user_id = ? AND expires_at > datetime('now')", [userId]);
      return !!r;
    }
  },
  stories: {
    create(story) {
      db.run('INSERT INTO stories (user_id, media) VALUES (?, ?)', [story.user_id, story.media]);
      const id = lastId();
      save();
      return { id, ...story };
    },
    findFriendsStories(userId) {
      return queryAll(
        `SELECT s.*, u.firstname, u.lastname, u.avatar FROM stories s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.user_id IN (
           SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END 
           FROM friends WHERE (sender_id = ? OR receiver_id = ?) AND status = "accepted"
         ) OR s.user_id = ?
         ORDER BY s.created_at DESC`,
        [userId, userId, userId, userId]
      );
    },
    findById(id) {
      return queryOne('SELECT s.*, u.firstname, u.lastname, u.avatar FROM stories s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [id]);
    },
    delete(id) {
      db.run('DELETE FROM stories WHERE id = ?', [id]);
      save();
    },
    deleteExpired() {
      db.run("DELETE FROM stories WHERE created_at < datetime('now', '-1 day')");
      save();
    }
  }
};

module.exports = api;
