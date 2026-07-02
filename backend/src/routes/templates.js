/**
 * TEMPLATES ROUTE — Full CRUD + activate
 * When activated, template is written to src/templates/message.txt
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { queryOne, queryAll, run } = require('../database/db');

const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const TEMPLATE_FILE = path.join(PROJECT_ROOT, 'src/templates/message.txt');

function seedDefaultTemplate() {
  const existing = queryOne('SELECT COUNT(*) as c FROM templates');
  if (existing && existing.c > 0) return;

  let content = 'Hi {Name},\n\nI hope you\'re doing well.\n\nBest regards';
  try { content = fs.readFileSync(TEMPLATE_FILE, 'utf-8'); } catch {}
  run('INSERT INTO templates (name, content, is_active) VALUES (?, ?, 1)', ['Default Template', content]);
}

router.get('/', (req, res) => {
  try {
    seedDefaultTemplate();
    const templates = queryAll('SELECT * FROM templates ORDER BY created_at DESC');
    res.json(templates);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const template = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
    const result = run('INSERT INTO templates (name, content, is_active) VALUES (?, ?, 0)', [name, content]);
    const template = queryOne('SELECT * FROM templates WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, content } = req.body;
    const existing = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    run(`UPDATE templates SET name = ?, content = ?, updated_at = datetime('now') WHERE id = ?`,
      [name ?? existing.name, content ?? existing.content, req.params.id]);
    const template = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    res.json(template);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.is_active) return res.status(400).json({ error: 'Cannot delete the active template' });
    run('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/activate', (req, res) => {
  try {
    const template = queryOne('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    run('UPDATE templates SET is_active = 0');
    run('UPDATE templates SET is_active = 1 WHERE id = ?', [req.params.id]);
    fs.mkdirSync(path.dirname(TEMPLATE_FILE), { recursive: true });
    fs.writeFileSync(TEMPLATE_FILE, template.content, 'utf-8');
    res.json({ success: true, message: 'Template activated and written to message.txt' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
