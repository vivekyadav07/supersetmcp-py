require('dotenv').config();
const mysql = require('mysql2/promise');

// Create a connection pool. This is more efficient than creating a new connection
// for every query, as it reuses existing connections.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// We no longer need the complex DB class.
// We will just export the pool directly.
// The service files will be responsible for using this pool to execute queries.

// We can also add a simple function to test the connection on startup.
async function checkConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    connection.release();
  } catch (error) {
    console.error('❌ Could not connect to the database:', error.message);
    // Exit the process if we can't connect to the database.
    // This prevents the app from running in a broken state.
    process.exit(1);
  }
}

module.exports = {
  pool,
  checkConnection,
};