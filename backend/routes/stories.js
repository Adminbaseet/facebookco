const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  db.stories.deleteExpired();
  const stories = db.stories.findFriendsStories(req.user.id);
  res.json({ stories });
});

router.post('/', authenticateToken, (req, res) => {
  const { media } = req.body;
  if (!media) return res.status(400).json({ error: 'Media is required' });
  const story = db.stories.create({ user_id: req.user.id, media });
  const user = db.users.findById(req.user.id);
  res.status(201).json({
    story: {
      ...story,
      firstname: user.firstname,
      lastname: user.lastname,
      avatar: user.avatar
    }
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const story = db.stories.findById(parseInt(req.params.id));
  if (!story) return res.status(404).json({ error: 'Story not found' });
  res.json({ story });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const story = db.stories.findById(parseInt(req.params.id));
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (story.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  db.stories.delete(parseInt(req.params.id));
  res.json({ message: 'Story deleted' });
});

module.exports = router;
