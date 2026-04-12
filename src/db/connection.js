const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function createPool() {
  if (pool) return pool;

  const isExternal = process.env.DB_EXTERNAL === 'true';
  
  const config = {
    host: isExternal ? process.env.DB_EXTERNAL_HOST : process.env.DB_HOST,
    port: parseInt(isExternal ? process.env.DB_EXTERNAL_PORT : process.env.DB_PORT),
    user: isExternal ? process.env.DB_EXTERNAL_USER : process.env.DB_USER,
    password: isExternal ? process.env.DB_EXTERNAL_PASSWORD : process.env.DB_PASSWORD,
    database: isExternal ? process.env.DB_EXTERNAL_DB : process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  pool = mysql.createPool(config);
  
  // Test connection
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection established successfully');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    throw error;
  }

  return pool;
}

async function getPool() {
  if (!pool) {
    return await createPool();
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL pool closed');
  }
}

module.exports = {
  getPool,
  createPool,
  closePool
};
