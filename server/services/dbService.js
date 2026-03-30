/**
 * SentriX SQLite Database Service.
 * Persistence layer for message detections and evidence screenshots.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');

const DB_PATH = path.join(__dirname, '../sentrix.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("[Database] Error opening database:", err.message);
  } else {
    console.log("[Database] Connected to SQLite.");
    init();
  }
});

/**
 * Initializes tables for saving persistent message history.
 */
function init() {
  db.run(`
    CREATE TABLE IF NOT EXISTS detections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT,
      severity TEXT,
      reason TEXT,
      screenshot TEXT, -- Base64 encoded screenshot
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Persists a new detection to the database.
 */
const saveDetection = async (data) => {
  return new Promise((resolve, reject) => {
    const { text, severity, reason, screenshot } = data;
    const query = `INSERT INTO detections (text, severity, reason, screenshot) VALUES (?, ?, ?, ?)`;
    
    db.run(query, [text, severity, reason, screenshot], function(err) {
      if (err) {
        console.error("[Database] Error saving detection:", err.message);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

/**
 * Fetches all detections from newest to oldest.
 */
const getDetections = async () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM detections ORDER BY timestamp DESC`, [], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
};

module.exports = { saveDetection, getDetections };
