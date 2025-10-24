// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'alerts.db');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // put index.html in ./public

// initialize db
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT,
    ts INTEGER NOT NULL
  );`);
});

window.initMap = initMap;

// endpoint to accept alerts
app.post('/alerts', (req, res) => {
  let { latitude, longitude, address } = req.body || {};
  latitude = parseFloat(latitude);
  longitude = parseFloat(longitude);
  if (isNaN(latitude) || isNaN(longitude)) {
    res.status(400).json({ ok: false, error: 'Invalid lat/lng' });
    return;
  }
  const ts = Date.now();
  const stmt = db.prepare('INSERT INTO alerts (latitude, longitude, address, ts) VALUES (?, ?, ?, ?)');
  stmt.run(latitude, longitude, address || null, ts, function(err) {
    if (err) {
      console.error('DB insert error', err);
      res.status(500).json({ ok: false, error: 'DB error' });
    } else {
      res.json({ ok: true, id: this.lastID, ts });
    }
  });
});


// simple admin view
app.get('/admin', (req, res) => {
  db.all('SELECT * FROM alerts ORDER BY ts DESC LIMIT 500', (err, rows) => {
    if (err) {
      res.status(500).send('DB read error');
      return;
    }
    const rowsHtml = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.latitude}</td>
        <td>${r.longitude}</td>
        <td>${r.address ? r.address.replace(/</g,'&lt;') : ''}</td>
        <td>${new Date(r.ts).toLocaleString()}</td>
      </tr>
    `).join('');
    const html = `
      <html><head>
      <meta charset="utf-8" />
      <title>Admin — Alerts</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px}
        table{border-collapse:collapse;width:100%;max-width:1100px}
        th,td{border:1px solid #ddd;padding:8px}
        th{background:#f4f4f4}
        tr:nth-child(even){background:#fafafa}
      </style>
      </head><body>
      <h1>Saved Alerts (local)</h1>
      <p><a href="/">Back to site</a></p>
      <table>
        <thead><tr><th>ID</th><th>Latitude</th><th>Longitude</th><th>Address</th><th>Timestamp</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      </body></html>
    `;
    res.send(html);
  });
});

// fallback to index
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname,'public','index1.html'));
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
