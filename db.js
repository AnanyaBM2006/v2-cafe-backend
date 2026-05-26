const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a highly responsive connection pool that dynamically shifts destinations
const pool = mysql.createPool({
  // 🌟 If DATABASE_HOST is set on Render, use it. Otherwise, fallback to your local laptop (localhost)
  host: process.env.DATABASE_HOST || 'localhost',
  user: process.env.DATABASE_HOST ? 'cafe_remote_user' : 'root', 
  password: process.env.DATABASE_HOST ? 'secure_password123' : '', 
  database: 'v2_cafe_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;