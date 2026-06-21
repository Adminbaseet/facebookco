const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const groups = db.groups.findForUser(req.user.id);
  const result = groups.map(g => ({
    ...g,
    member_count: db.groups.memberCount(g.id)
  }));
  res.json({ groups: result });
});

router.get('/all', authenticateToken, (req, res) => {
  const groups = db.groups.findAll();
  const result = groups.map(g => ({
    ...g,
    member_count: db.groups.memberCount(g.id),
    is_member: db.groups.isMember(g.id, req.user.id)
  }));
  res.json({ groups: result });
});

router.get('/search', authenticateToken, (req, res) => {
  const q = req.query.q || '';
  const groups = db.groups.search(q);
  const result = groups.map(g => ({
    ...g,
    member_count: db.groups.memberCount(g.id),
    is_member: db.groups.isMember(g.id, req.user.id)
  }));
  res.json({ groups: result });
});

router.post('/', authenticateToken, (req, res) => {
  const { name, description, cover_photo } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
  const group = db.groups.create({
    name: name.trim(),
    description: (description || '').trim(),
    cover_photo: cover_photo || '',
    created_by: req.user.id
  });
  res.status(201).json({
    group: {
      ...group,
      member_count: 1,
      role: 'admin'
    }
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const group = db.groups.findById(parseInt(req.params.id));
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const members = db.groups.getMembers(group.id);
  const role = db.groups.getRole(group.id, req.user.id);
  res.json({
    group: {
      ...group,
      member_count: members.length,
      members,
      is_member: !!role,
      role
    }
  });
});

router.post('/:id/join', authenticateToken, (req, res) => {
  const groupId = parseInt(req.params.id);
  const group = db.groups.findById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  db.groups.join(groupId, req.user.id);
  res.json({ message: 'Joined group' });
});

router.post('/:id/leave', authenticateToken, (req, res) => {
  const groupId = parseInt(req.params.id);
  const group = db.groups.findById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const role = db.groups.getRole(groupId, req.user.id);
  if (role === 'admin') return res.status(400).json({ error: 'Admins cannot leave. Transfer ownership first.' });
  db.groups.leave(groupId, req.user.id);
  res.json({ message: 'Left group' });
});

router.get('/:id/posts', authenticateToken, (req, res) => {
  const groupId = parseInt(req.params.id);
  const group = db.groups.findById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const posts = db.queryAll('SELECT * FROM posts WHERE group_id = ? ORDER BY created_at DESC', [groupId]);
  const result = posts.map(post => {
    const user = db.users.findById(post.user_id);
    const comments = db.comments.findByPost(post.id);
    const liked = db.likes.find(post.id, req.user.id);
    const likesCount = db.likes.count(post.id);
    return {
      id: post.id,
      author: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
      avatar: user ? user.avatar : '',
      text: post.text,
      image: post.image,
      time: formatTime(post.created_at),
      likes: likesCount,
      liked: !!liked,
      comments: comments.map(c => {
        const cu = db.users.findById(c.user_id);
        return {
          id: c.id,
          author: cu ? `${cu.firstname} ${cu.lastname}` : 'Unknown',
          avatar: cu ? cu.avatar : '',
          text: c.text
        };
      })
    };
  });

  res.json({ posts: result, group: { ...group, member_count: db.groups.memberCount(groupId) } });
});

router.post('/:id/posts', authenticateToken, (req, res) => {
  const groupId = parseInt(req.params.id);
  const { text, image } = req.body;
  if ((!text || !text.trim()) && !image) return res.status(400).json({ error: 'Text or image is required' });
  const group = db.groups.findById(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!db.groups.isMember(groupId, req.user.id)) return res.status(403).json({ error: 'You must be a member to post' });

  const user = db.users.findById(req.user.id);
  db.run('INSERT INTO posts (user_id, text, image, group_id) VALUES (?, ?, ?, ?)', [req.user.id, (text || '').trim(), image || null, groupId]);
  db.save();
  const postId = db.lastId();

  res.status(201).json({
    post: {
      id: postId,
      author: `${user.firstname} ${user.lastname}`,
      avatar: user.avatar,
      text: text || '',
      image: image || null,
      time: 'Just now',
      likes: 0,
      liked: false,
      comments: []
    }
  });
});

function formatTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

module.exports = router;
