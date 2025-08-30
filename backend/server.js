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
      const { title, description, parent_id, status, priority, file_id, x_position, y_position } = req.body;
      const user_id = req.user.userId; // 从JWT token中获取用户ID

      // 验证必填字段
      if (!title) {
        return res.status(400).json({ error: '目标标题不能为空' });
      }

      // 插入新目标
      const newGoal = await pool.query(
        `INSERT INTO goals
         (user_id, parent_id, title, description, status, priority, created_at, updated_at, order_index, file_id, x_position, y_position)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 0, $7, $8, $9)
         RETURNING *`,
        [user_id, parent_id || null, title, description || '', status || 'active', priority || 1, file_id || null, x_position || null, y_position || null]
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
    const { file_id } = req.query; // 获取文件ID参数
    
    let goals;
    if (file_id) {
      // 查询指定文件的目标
      goals = await pool.query(
        'SELECT * FROM goals WHERE user_id = $1 AND file_id = $2 ORDER BY created_at DESC',
        [user_id, file_id]
      );
    } else {
      // 查询该用户的所有目标（向后兼容）
      goals = await pool.query(
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
        [user_id]
      );
    }
    
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

// ==================== 文件管理接口 ====================

// 递归构建文件树
function buildFileTree(files, parentId = null) {
  const tree = [];
  for (const file of files) {
    if (file.parent_id === parentId) {
      const children = buildFileTree(files, file.id);
      tree.push({
        ...file,
        children: children.length > 0 ? children : []
      });
    }
  }
  return tree;
}

// 获取用户所有文件
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE user_id = $1 ORDER BY type DESC, name ASC',
      [req.user.userId]
    );

    // 如果用户没有文件，创建默认文件
    if (result.rows.length === 0) {
      const defaultFile = await pool.query(
        'INSERT INTO files (name, user_id, type) VALUES ($1, $2, $3) RETURNING *',
        ['我的理想规划', req.user.userId, 'file']
      );
      return res.json({ files: defaultFile.rows, tree: defaultFile.rows });
    }

    // 构建树形结构
    const tree = buildFileTree(result.rows);
    
    res.json({ files: result.rows, tree });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

// 创建新文件或文件夹
app.post('/api/files', authenticateToken, async (req, res) => {
  try {
    const { name, type = 'file', parent_id = null } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '名称不能为空' });
    }
    
    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ error: '类型必须是file或folder' });
    }

    // 如果指定了父文件夹，检查父文件夹是否存在且属于当前用户
    if (parent_id) {
      const parentCheck = await pool.query(
        'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND type = $3',
        [parent_id, req.user.userId, 'folder']
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: '指定的父文件夹不存在' });
      }
    }

    const result = await pool.query(
      'INSERT INTO files (name, user_id, type, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), req.user.userId, type, parent_id]
    );

    res.status(201).json({ file: result.rows[0] });
  } catch (error) {
    console.error('创建失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新文件名
app.put('/api/files/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '文件名不能为空' });
    }

    const result = await pool.query(
      'UPDATE files SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [name.trim(), id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '文件不存在或无权限访问' });
    }

    res.json({ file: result.rows[0] });
  } catch (error) {
    console.error('更新文件失败:', error);
    res.status(500).json({ error: '更新文件失败' });
  }
});

// 移动文件/文件夹到指定文件夹
app.patch('/api/files/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id } = req.body;
    
    // 检查文件是否存在且属于当前用户
    const fileCheck = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: '文件不存在或无权限访问' });
    }
    
    // 如果指定了父文件夹，检查父文件夹是否存在
    if (parent_id !== null) {
      const parentCheck = await pool.query(
        'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND type = $3',
        [parent_id, req.user.userId, 'folder']
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: '指定的父文件夹不存在' });
      }
      
      // 防止将文件夹移动到自己的子文件夹中（避免循环引用）
      if (fileCheck.rows[0].type === 'folder') {
        const checkCycle = await pool.query(
          'WITH RECURSIVE folder_tree AS (SELECT id, parent_id FROM files WHERE id = $1 AND user_id = $2 UNION SELECT f.id, f.parent_id FROM files f INNER JOIN folder_tree ft ON f.parent_id = ft.id WHERE f.user_id = $2) SELECT id FROM folder_tree WHERE id = $3',
          [parent_id, req.user.userId, id]
        );
        if (checkCycle.rows.length > 0) {
          return res.status(400).json({ error: '不能将文件夹移动到其子文件夹中' });
        }
      }
    }
    
    const result = await pool.query(
      'UPDATE files SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [parent_id, id, req.user.userId]
    );
    
    res.json({ file: result.rows[0] });
  } catch (error) {
    console.error('移动文件失败:', error);
    res.status(500).json({ error: '移动文件失败' });
  }
});

// 删除文件或文件夹（递归删除）
app.delete('/api/files/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查文件是否存在且属于当前用户
    const fileCheck = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: '文件不存在或无权限访问' });
    }
    
    const file = fileCheck.rows[0];
    
    // 如果是文件夹，先递归删除所有子项
    if (file.type === 'folder') {
      // 删除该文件夹下的所有目标
      await pool.query(
        'DELETE FROM goals WHERE file_id = $1 AND user_id = $2',
        [id, req.user.userId]
      );
      
      // 递归删除所有子文件和子文件夹（使用CASCADE删除）
      await pool.query(
        'WITH RECURSIVE folder_tree AS (SELECT id FROM files WHERE id = $1 AND user_id = $2 UNION SELECT f.id FROM files f INNER JOIN folder_tree ft ON f.parent_id = ft.id WHERE f.user_id = $2) DELETE FROM files WHERE id IN (SELECT id FROM folder_tree) AND user_id = $2',
        [id, req.user.userId]
      );
    } else {
      // 删除文件相关的目标
      await pool.query(
        'DELETE FROM goals WHERE file_id = $1 AND user_id = $2',
        [id, req.user.userId]
      );
      
      // 删除文件
      await pool.query(
        'DELETE FROM files WHERE id = $1 AND user_id = $2',
        [id, req.user.userId]
      );
    }

    res.json({ message: file.type === 'folder' ? '文件夹删除成功' : '文件删除成功', file });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

//================ 节点连接管理API ================

// 获取文件的所有连接
app.get('/api/connections/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // 验证文件权限
    const fileCheck = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: '文件不存在或无权限访问' });
    }
    
    // 获取连接数据
    const connections = await pool.query(
      'SELECT * FROM goal_connections WHERE file_id = $1',
      [fileId]
    );
    
    res.json({ connections: connections.rows });
  } catch (error) {
    console.error('获取连接失败:', error);
    res.status(500).json({ error: '获取连接失败' });
  }
});

// 创建新连接
app.post('/api/connections', authenticateToken, async (req, res) => {
  try {
    const { from_goal_id, to_goal_id, file_id } = req.body;
    
    // 验证文件权限
    const fileCheck = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND user_id = $2',
      [file_id, req.user.userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: '文件不存在或无权限访问' });
    }
    
    // 验证节点是否属于该文件
    const goalCheck = await pool.query(
      'SELECT COUNT(*) as count FROM goals WHERE (id = $1 OR id = $2) AND file_id = $3 AND user_id = $4',
      [from_goal_id, to_goal_id, file_id, req.user.userId]
    );
    
    if (goalCheck.rows[0].count !== '2') {
      return res.status(400).json({ error: '节点不存在或无权限' });
    }
    
    // 检查是否已存在相同连接
    const existingConnection = await pool.query(
      'SELECT * FROM goal_connections WHERE from_goal_id = $1 AND to_goal_id = $2 AND file_id = $3',
      [from_goal_id, to_goal_id, file_id]
    );
    
    if (existingConnection.rows.length > 0) {
      return res.status(400).json({ error: '连接已存在' });
    }
    
    // 创建连接
    const connection = await pool.query(
      'INSERT INTO goal_connections (from_goal_id, to_goal_id, file_id) VALUES ($1, $2, $3) RETURNING *',
      [from_goal_id, to_goal_id, file_id]
    );
    
    res.json({ connection: connection.rows[0], message: '连接创建成功' });
  } catch (error) {
    console.error('创建连接失败:', error);
    res.status(500).json({ error: '创建连接失败' });
  }
});

// 删除连接
app.delete('/api/connections/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证连接是否存在且有权限（通过文件所有权验证）
    const connectionCheck = await pool.query(
      `SELECT gc.*, f.user_id 
       FROM goal_connections gc 
       JOIN files f ON gc.file_id = f.id 
       WHERE gc.id = $1 AND f.user_id = $2`,
      [id, req.user.userId]
    );
    
    if (connectionCheck.rows.length === 0) {
      return res.status(404).json({ error: '连接不存在或无权限删除' });
    }
    
    // 删除连接
    await pool.query('DELETE FROM goal_connections WHERE id = $1', [id]);
    
    res.json({ message: '连接删除成功' });
  } catch (error) {
    console.error('删除连接失败:', error);
    res.status(500).json({ error: '删除连接失败' });
  }
});

//================ 节点位置管理API ================

// 保存节点位置
app.put('/api/goals/:id/position', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { x_position, y_position } = req.body;
    
    // 验证参数
    if (typeof x_position !== 'number' || typeof y_position !== 'number') {
      return res.status(400).json({ error: '坐标必须是数字' });
    }
    
    // 验证目标是否存在且属于当前用户
    const goalCheck = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ error: '目标不存在或无权限' });
    }
    
    // 更新位置
    await pool.query(
      'UPDATE goals SET x_position = $1, y_position = $2 WHERE id = $3 AND user_id = $4',
      [x_position, y_position, id, req.user.userId]
    );
    
    res.json({ message: '位置更新成功', x_position, y_position });
  } catch (error) {
    console.error('保存节点位置失败:', error);
    res.status(500).json({ error: '保存位置失败' });
  }
});

// 批量更新节点位置
app.put('/api/goals/positions', authenticateToken, async (req, res) => {
  try {
    const { positions } = req.body; // [{id, x_position, y_position}, ...]
    
    if (!Array.isArray(positions)) {
      return res.status(400).json({ error: 'positions必须是数组' });
    }
    
    // 批量更新
    for (const pos of positions) {
      if (typeof pos.x_position === 'number' && typeof pos.y_position === 'number') {
        await pool.query(
          'UPDATE goals SET x_position = $1, y_position = $2 WHERE id = $3 AND user_id = $4',
          [pos.x_position, pos.y_position, pos.id, req.user.userId]
        );
      }
    }
    
    res.json({ message: '批量位置更新成功' });
  } catch (error) {
    console.error('批量保存节点位置失败:', error);
    res.status(500).json({ error: '批量保存位置失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});