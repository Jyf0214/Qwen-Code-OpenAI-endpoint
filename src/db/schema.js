const { getPool } = require('./connection');

async function initializeDatabase() {
  const pool = await getPool();

  const queries = [
    // Accounts table
    `CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      device_code VARCHAR(500),
      user_code VARCHAR(50),
      verification_uri TEXT,
      verification_uri_complete TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_type VARCHAR(50) DEFAULT 'Bearer',
      expires_at DATETIME,
      scope VARCHAR(255),
      pkce_verifier VARCHAR(255),
      pkce_challenge VARCHAR(255),
      status ENUM('pending', 'active', 'expired', 'error') DEFAULT 'pending',
      is_active BOOLEAN DEFAULT true,
      request_count INT DEFAULT 0,
      last_used_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_is_active (is_active),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Request logs table
    `CREATE TABLE IF NOT EXISTS request_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT,
      model VARCHAR(255),
      endpoint VARCHAR(255),
      method VARCHAR(10),
      status_code INT,
      response_time INT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      INDEX idx_account_id (account_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Settings table
    `CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(255) UNIQUE NOT NULL,
      key_value TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const query of queries) {
    try {
      await pool.execute(query);
    } catch (error) {
      console.error(`Error creating table: ${error.message}`);
    }
  }

  // Insert default settings if not exists
  const defaultSettings = [
    ['polling_strategy', 'round-robin', 'Account polling strategy: round-robin or least-used'],
    ['default_model', 'qwen3-coder-plus', 'Default model for API requests'],
    ['auto_refresh_token', 'true', 'Automatically refresh tokens when expired']
  ];

  for (const [key, value, description] of defaultSettings) {
    await pool.execute(
      'INSERT IGNORE INTO settings (key_name, key_value, description) VALUES (?, ?, ?)',
      [key, value, description]
    );
  }

  console.log('✅ Database initialized successfully');
}

module.exports = {
  initializeDatabase
};
