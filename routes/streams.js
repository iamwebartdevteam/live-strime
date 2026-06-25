const express = require('express');
const { authRequired } = require('../middleware/auth');
const { streams } = require('../store');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const list = Array.from(streams.values()).map(s => ({
    id: s.id,
    title: s.title,
    creator: s.creator,
    viewers: s.viewers,
    startedAt: s.startedAt
  }));
  res.json({ streams: list });
});

router.get('/:id', authRequired, (req, res) => {
  const s = streams.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Stream not found' });
  res.json({
    id: s.id,
    title: s.title,
    creator: s.creator,
    viewers: s.viewers,
    startedAt: s.startedAt
  });
});

module.exports = router;
