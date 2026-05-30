const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const DB_PATH = path.join(__dirname, 'plant.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      moisture INTEGER,
      temperature REAL,
      humidity REAL,
      light_level INTEGER
    )
  `, (err) => {
    if (err) console.error('Table creation error:', err);
    else console.log('sensor_data table ready');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS device_config (
      id INTEGER PRIMARY KEY,
      device_name TEXT,
      device_ip TEXT,
      device_mac TEXT,
      mode TEXT DEFAULT 'AUTO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Table creation error:', err);
    else console.log('device_config table ready');
  });
}

// ────────────────────────────────────
// API ENDPOINTS
// ────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Doctor Plant Server Running 🌿' });
});

// Get sensor data
app.get('/api/sensor-data', (req, res) => {
  const limit = req.query.limit || 50;
  const query = `
    SELECT * FROM sensor_data 
    ORDER BY timestamp DESC 
    LIMIT ?
  `;

  db.all(query, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Get latest sensor reading
app.get('/api/sensor-data/latest', (req, res) => {
  const query = `
    SELECT * FROM sensor_data 
    ORDER BY timestamp DESC 
    LIMIT 1
  `;

  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || {});
    }
  });
});

// Add sensor data
app.post('/api/sensor-data', (req, res) => {
  const { moisture, temperature, humidity, light_level } = req.body;

  if (moisture === undefined) {
    return res.status(400).json({ error: 'moisture is required' });
  }

  const query = `
    INSERT INTO sensor_data (moisture, temperature, humidity, light_level)
    VALUES (?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      moisture,
      temperature || null,
      humidity || null,
      light_level || null
    ],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true, message: 'Sensor data saved' });
      }
    }
  );
});

// Get device configuration
app.get('/api/config', (req, res) => {
  const query = `SELECT * FROM device_config WHERE id = 1`;

  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || {});
    }
  });
});

// Update device configuration
app.post('/api/config', (req, res) => {
  const { device_name, device_ip, device_mac, mode } = req.body;

  const checkQuery = `SELECT id FROM device_config WHERE id = 1`;

  db.get(checkQuery, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (row) {
      const updateQuery = `
        UPDATE device_config 
        SET device_name = ?, device_ip = ?, device_mac = ?, mode = ?
        WHERE id = 1
      `;
      db.run(updateQuery, [device_name, device_ip, device_mac, mode], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ success: true, message: 'Config updated' });
        }
      });
    } else {
      const insertQuery = `
        INSERT INTO device_config (id, device_name, device_ip, device_mac, mode)
        VALUES (1, ?, ?, ?, ?)
      `;
      db.run(insertQuery, [device_name, device_ip, device_mac, mode], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({ success: true, message: 'Config created' });
        }
      });
    }
  });
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_readings,
      AVG(moisture) as avg_moisture,
      MAX(moisture) as max_moisture,
      MIN(moisture) as min_moisture,
      AVG(temperature) as avg_temp,
      AVG(humidity) as avg_humidity
    FROM sensor_data
  `;

  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || {});
    }
  });
});

// Simple prediction endpoint (client-side will handle ML)
app.get('/api/predict', (req, res) => {
  const query = `
    SELECT moisture FROM sensor_data 
    ORDER BY timestamp DESC 
    LIMIT 5
  `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!rows || rows.length < 2) {
      res.json({
        prediction: 'Not enough data',
        predicted_moisture: 0
      });
    } else {
      // Simple trend-based prediction
      const moistures = rows.map(r => r.moisture).reverse();
      const trend = moistures[moistures.length - 1] - moistures[0];
      const predicted = moistures[moistures.length - 1] + (trend / moistures.length);

      let status = 'Healthy Growth 🌿';
      if (predicted > 3000) status = 'Water Needed Soon 🚰';
      else if (predicted > 2000) status = 'Monitor Plant 🌱';

      res.json({
        predicted_moisture: Math.round(predicted),
        prediction: status
      });
    }
  });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🌿 Doctor Plant Server Running 🌿`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`\nAPI endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/sensor-data`);
  console.log(`  GET  /api/sensor-data/latest`);
  console.log(`  POST /api/sensor-data`);
  console.log(`  GET  /api/predict`);
  console.log(`  GET  /api/stats`);
  console.log(`  GET  /api/config`);
  console.log(`  POST /api/config\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close((err) => {
    if (err) console.error(err);
    process.exit(0);
  });
});
