const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/coins', authenticateToken, (req, res) => {
  const balance = db.monetize.getCoins(req.user.id);
  res.json({ balance });
});

router.post('/coins/buy', authenticateToken, (req, res) => {
  const { amount, payment_method } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

  // Mock payment — in production, integrate Stripe/PayPal here
  const balance = db.monetize.addCoins(req.user.id, amount);
  db.monetize.recordPurchase(req.user.id, amount, payment_method || 'mock');
  res.json({ balance, message: `${amount} coins added!` });
});

router.post('/premium/buy', authenticateToken, (req, res) => {
  const { plan } = req.body;
  const prices = { basic: { coins: 100, days: 30 }, pro: { coins: 500, days: 365 } };
  const price = prices[plan];
  if (!price) return res.status(400).json({ error: 'Invalid plan' });

  if (!db.monetize.spendCoins(req.user.id, price.coins)) {
    return res.status(402).json({ error: `Need ${price.coins} coins for ${plan} plan` });
  }
  const prem = db.monetize.setPremium(req.user.id, plan, price.days);
  res.json({ premium: prem, message: `${plan} plan activated!` });
});

router.get('/premium', authenticateToken, (req, res) => {
  const prem = db.monetize.getPremium(req.user.id);
  const active = db.monetize.isPremium(req.user.id);
  res.json({ premium: prem, active });
});

router.get('/purchases', authenticateToken, (req, res) => {
  const purchases = db.queryAll('SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json({ purchases });
});

module.exports = router;
