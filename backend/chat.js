const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./middleware/auth');

const router = express.Router();

router.get('/users', authenticateToken, (req, res) => {
  const users = db.queryAll('SELECT id, firstname, lastname, avatar FROM users WHERE id != ?', [req.user.id]);
  res.json({ users });
});

router.get('/conversations', authenticateToken, (req, res) => {
  const conversations = db.conversations.findByUser(req.user.id);
  const result = conversations.map(c => {
    const otherId = c.participants.find(p => p !== req.user.id);
    const otherUser = otherId ? db.users.findById(otherId) : null;
    return {
      id: c.id,
      with_user: otherUser ? { id: otherUser.id, firstname: otherUser.firstname, lastname: otherUser.lastname, avatar: otherUser.avatar } : null,
      last_message: c.last_message,
      last_activity: c.last_activity,
      participants: c.participants
    };
  });
  res.json({ conversations: result });
});

router.post('/conversations', authenticateToken, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  if (user_id === req.user.id) return res.status(400).json({ error: 'Cannot chat with yourself' });

  const otherUser = db.users.findById(user_id);
  if (!otherUser) return res.status(404).json({ error: 'User not found' });

  let conv = db.conversations.findBetweenUsers(req.user.id, user_id);
  if (!conv) {
    conv = db.conversations.create([req.user.id, user_id]);
  }
  if (!conv) return res.status(500).json({ error: 'Failed to create conversation' });

  const otherId = conv.participants.find(p => p !== req.user.id);
  const ou = db.users.findById(otherId);
  res.json({
    conversation: {
      id: conv.id,
      with_user: ou ? { id: ou.id, firstname: ou.firstname, lastname: ou.lastname, avatar: ou.avatar } : null,
      participants: conv.participants,
      last_message: conv.last_message,
      last_activity: conv.last_activity
    }
  });
});

router.get('/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = parseInt(req.params.id);
  const conv = db.conversations.findById(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.participants.includes(req.user.id)) return res.status(403).json({ error: 'Not a participant' });

  const messages = db.messages.findByConversation(convId);
  const result = messages.map(m => {
    const user = db.users.findById(m.sender_id);
    return {
      id: m.id,
      sender_id: m.sender_id,
      text: m.text,
      created_at: m.created_at,
      sender_name: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
      sender_avatar: user ? user.avatar : ''
    };
  });
  res.json({ messages: result });
});

router.post('/conversations/:id/messages', authenticateToken, (req, res) => {
  const convId = parseInt(req.params.id);
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required' });

  const conv = db.conversations.findById(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.participants.includes(req.user.id)) return res.status(403).json({ error: 'Not a participant' });

  const msg = db.messages.create({
    conversation_id: convId,
    sender_id: req.user.id,
    text: text.trim()
  });

  db.conversations.updateLastMessage(convId, text.trim(), req.user.id);

  const user = db.users.findById(req.user.id);
  res.status(201).json({
    message: {
      id: msg.id,
      sender_id: msg.sender_id,
      text: msg.text,
      created_at: msg.created_at,
      sender_name: user ? `${user.firstname} ${user.lastname}` : 'Unknown',
      sender_avatar: user ? user.avatar : ''
    }
  });
});

module.exports = router;
