const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const friends = db.friends.getFriends(req.user.id);
  res.json({ friends });
});

router.get('/requests', authenticateToken, (req, res) => {
  const requests = db.friends.getRequests(req.user.id);
  res.json({ requests });
});

router.get('/sent', authenticateToken, (req, res) => {
  const sent = db.friends.getSentRequests(req.user.id);
  res.json({ sent });
});

router.get('/suggestions', authenticateToken, (req, res) => {
  const suggestions = db.friends.getSuggestions(req.user.id);
  res.json({ suggestions });
});

router.get('/status/:userId', authenticateToken, (req, res) => {
  const status = db.friends.getStatus(req.user.id, parseInt(req.params.userId));
  res.json({ status });
});

router.post('/request/:userId', authenticateToken, (req, res) => {
  const receiverId = parseInt(req.params.userId);
  if (receiverId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });
  const user = db.users.findById(receiverId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.friends.request(req.user.id, receiverId);
  res.json({ message: 'Friend request sent' });
});

router.post('/accept/:userId', authenticateToken, (req, res) => {
  const senderId = parseInt(req.params.userId);
  db.friends.accept(senderId, req.user.id);
  res.json({ message: 'Friend request accepted' });
});

router.post('/reject/:userId', authenticateToken, (req, res) => {
  const senderId = parseInt(req.params.userId);
  db.friends.reject(senderId, req.user.id);
  res.json({ message: 'Friend request rejected' });
});

router.delete('/:userId', authenticateToken, (req, res) => {
  db.friends.remove(req.user.id, parseInt(req.params.userId));
  res.json({ message: 'Unfriended' });
});

module.exports = router;
