const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Initialize database tables
const initDatabase = async () => {
  try {
    // Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
        phone VARCHAR(20),
        license_number VARCHAR(100),
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Rooms table
    await query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_code VARCHAR(100) UNIQUE NOT NULL,
        doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        max_participants INTEGER DEFAULT 2,
        status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
        encryption_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);

    // Call history table
    await query(`
      CREATE TABLE IF NOT EXISTS call_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        doctor_id UUID REFERENCES users(id),
        patient_id UUID REFERENCES users(id),
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        duration INTEGER,
        connection_quality FLOAT,
        encryption_used BOOLEAN DEFAULT true,
        notes TEXT
      )
    `);

    // Indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_doctor ON rooms(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_call_history_doctor ON call_history(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_call_history_patient ON call_history(patient_id);
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

module.exports = {
  query,
  pool,
  initDatabase,
};
