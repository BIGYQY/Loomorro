 const { Pool } = require('pg');
  require('dotenv').config();

  // 创建数据库连接池
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  // 测试数据库连接
  pool.on('connect', () => {
    console.log('✅ 数据库连接成功！');
  });

  pool.on('error', (err) => {
    console.error('❌ 数据库连接错误:', err);
  });

  module.exports = pool;