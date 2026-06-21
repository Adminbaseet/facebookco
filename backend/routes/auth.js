const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { email, password, firstname, lastname, gender, day, month, year } = req.body;
  if (!email || !password || !firstname || !lastname) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = db.users.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const user = db.users.create({
    email,
    password: hash,
    firstname,
    lastname,
    gender: gender || 'male',
    dob_day: day || 1,
    dob_month: month || 1,
    dob_year: year || 2000,
    avatar: ''
  });

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.users.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = db.users.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.put('/profile', authenticateToken, (req, res) => {
  const { firstname, lastname, avatar, current_password, new_password } = req.body;
  const fields = {};
  if (firstname) fields.firstname = firstname;
  if (lastname) fields.lastname = lastname;
  if (avatar !== undefined) fields.avatar = avatar;

  if (current_password && new_password) {
    const user = db.users.findById(req.user.id);
    if (!user || !bcrypt.compareSync(current_password, user.password)) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }
    fields.password = bcrypt.hashSync(new_password, 10);
  }

  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const user = db.users.update(req.user.id, fields);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

module.exports = router;
