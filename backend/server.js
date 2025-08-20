const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 云环境适配
if (process.env.NODE_ENV === 'production') {
  // 生产环境配置
  console.log('🌐 运行在生产环境');
} else {
  console.log('🖥️ 运行在开发环境');
}

// 中间件
app.use(cors());
app.use(express.json());
// JWT验证中间件
  const authenticateToken = (req, res, next) => {
    // 从请求头中获取token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN格式

    if (!token) {
      return res.status(401).json({ error: '访问被拒绝，需要提供token' });
    }

    // 验证token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'token无效或已过期' });
      }

      // token有效，将用户信息存储到请求对象中
      req.user = user;
      next(); // 继续到下一个中间件或路由
    });
  };

// 测试接口
app.get('/', (req, res) => {
  res.json({ message: '🎉 Loomorro API 服务器运行正常！' });
});

// 用户注册接口
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // 检查邮箱是否已存在
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1', 
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 插入新用户
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash, username, created_at, updated_at, is_verified) VALUES ($1, $2, $3, NOW(), NOW(), false) RETURNING *',
      [email, hashedPassword, username]
    );
    
    res.status(201).json({
      message: '注册成功！',
      user: {
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        username: newUser.rows[0].username
      }
    });
    
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录接口
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // 检查邮箱和密码是否提供
      if (!email || !password) {
        return res.status(400).json({ error: '请提供邮箱和密码' });
      }

      // 查找用户
      const user = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (user.rows.length === 0) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 验证密码
      const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      // 生成JWT token
      const token = jwt.sign(
        {
          userId: user.rows[0].id,
          email: user.rows[0].email
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: '登录成功！',
        token: token,
        user: {
          id: user.rows[0].id,
          email: user.rows[0].email,
          username: user.rows[0].username
        }
      });

    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  });
  // 需要登录才能访问的测试接口
  app.get('/api/profile', authenticateToken, (req, res) => {
    res.json({
      message: '🎉 恭喜！你成功访问了需要登录的接口！',
      user: req.user,
      note: '这个信息只有登录用户才能看到'
    });
});

// 创建新目标接口（需要登录）
  app.post('/api/goals', authenticateToken, async (req, res) => {
    try {
      const { title, description, parent_id, status, priority } = req.body;
      const user_id = req.user.userId; // 从JWT token中获取用户ID

      // 验证必填字段
      if (!title) {
        return res.status(400).json({ error: '目标标题不能为空' });
      }

      // 插入新目标
      const newGoal = await pool.query(
        `INSERT INTO goals
         (user_id, parent_id, title, description, status, priority, created_at, updated_at, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 0)
         RETURNING *`,
        [user_id, parent_id || null, title, description || '', status || 'active', priority || 1]
      );

      res.status(201).json({
        message: '目标创建成功！',
        goal: newGoal.rows[0]
      });

    } catch (error) {
      console.error('创建目标错误:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  });

// 获取用户所有目标接口（需要登录）
app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.userId; // 从JWT获取用户ID
    
    // 查询该用户的所有目标
    const goals = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    
    res.json({
      message: '获取目标列表成功！',
      goals: goals.rows,
      count: goals.rows.length
    });
    
  } catch (error) {
    console.error('获取目标列表错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个目标详情接口（需要登录）
app.get('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const goalId = req.params.id;
    const user_id = req.user.userId;
    
    // 查询指定ID的目标，确保是当前用户的
    const goal = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, user_id]
    );
    
    if (goal.rows.length === 0) {
      return res.status(404).json({ error: '目标不存在或无权访问' });
    }
    
    res.json({
      message: '获取目标详情成功！',
      goal: goal.rows[0]
    });
    
  } catch (error) {
    console.error('获取目标详情错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新目标接口（需要登录）
app.put('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const goalId = req.params.id;
    const user_id = req.user.userId;
    const { title, description, status, priority } = req.body;
    
    // 先检查目标是否存在且属于当前用户
    const existingGoal = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, user_id]
    );
    
    if (existingGoal.rows.length === 0) {
      return res.status(404).json({ error: '目标不存在或无权访问' });
    }
    
    // 更新目标信息
    const updatedGoal = await pool.query(
      `UPDATE goals 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           status = COALESCE($3, status), 
           priority = COALESCE($4, priority),
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6 
       RETURNING *`,
      [title, description, status, priority, goalId, user_id]
    );
    
    res.json({
      message: '目标更新成功！',
      goal: updatedGoal.rows[0]
    });
    
  } catch (error) {
    console.error('更新目标错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除目标接口（需要登录）
app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const goalId = req.params.id;
    const user_id = req.user.userId;
    
    // 先检查目标是否存在且属于当前用户
    const existingGoal = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, user_id]
    );
    
    if (existingGoal.rows.length === 0) {
      return res.status(404).json({ error: '目标不存在或无权访问' });
    }
    
    // 删除目标
    await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2',
      [goalId, user_id]
    );
    
    res.json({
      message: '目标删除成功！',
      deletedGoal: existingGoal.rows[0]
    });
    
  } catch (error) {
    console.error('删除目标错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});


// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});