 const { Pool } = require('pg');
  require('dotenv').config();

  // 创建数据库连接池
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:vipnb668@@db.ypvlcegqyoismkumbqvv.supabase.co:5432/postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // 测试数据库连接
  pool.on('connect', () => {
    console.log('✅ 数据库连接成功！');
  });

  pool.on('error', (err) => {
    console.error('❌ 数据库连接错误:', err);
  });

  module.exports = pool;