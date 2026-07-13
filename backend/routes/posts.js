const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const posts = db.posts.findFeed();

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

  res.json({ posts: result });
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { text, image } = req.body;
    if ((!text || !text.trim()) && !image) return res.status(400).json({ error: 'Text or image is required' });

    const user = db.users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const post = db.posts.create({
      user_id: req.user.id,
      text: (text || '').trim(),
      image: image || null
    });

    if (!post) return res.status(500).json({ error: 'Failed to create post' });

    res.status(201).json({
      post: {
        id: post.id,
        author: `${user.firstname} ${user.lastname}`,
        avatar: user.avatar,
        text: post.text,
        image: post.image,
        time: 'Just now',
        likes: 0,
        liked: false,
        comments: []
      }
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  const post = db.posts.findById(parseInt(req.params.id));
  if (!post || post.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Post not found or unauthorized' });
  }

  db.posts.delete(post.id);
  res.json({ message: 'Post deleted' });
});

router.post('/:id/like', authenticateToken, (req, res) => {
  const postId = parseInt(req.params.id);
  const post = db.posts.findById(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.likes.find(postId, req.user.id);
  if (existing) {
    db.likes.remove(postId, req.user.id);
  } else {
    db.likes.add(postId, req.user.id);
  }

  const count = db.likes.count(postId);
  res.json({ liked: !existing, likes: count });
});

router.post('/:id/comments', authenticateToken, (req, res) => {
  const postId = parseInt(req.params.id);
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });

  const post = db.posts.findById(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const user = db.users.findById(req.user.id);
  db.comments.create({
    post_id: postId,
    user_id: req.user.id,
    text: text.trim()
  });

  res.status(201).json({
    comment: {
      author: `${user.firstname} ${user.lastname}`,
      avatar: user.avatar,
      text: text.trim()
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
