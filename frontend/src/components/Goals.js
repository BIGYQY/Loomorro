import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const Goals = ({ onLogout }) => {
  const [allGoals, setAllGoals] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [currentView, setCurrentView] = useState('workspace'); // 'workspace' or 'profile'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalDescription, setEditGoalDescription] = useState('');
  
  // 主题切换状态
  const [isDarkMode, setIsDarkMode] = useState(false); // 默认盛夏晨曦主题
  
  // 文件管理状态
  const [currentFile, setCurrentFile] = useState(null);
  const [allFiles, setAllFiles] = useState([]);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  
  // 画布相关状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // 获取token
  const getToken = () => localStorage.getItem('token');

  // 文件管理函数
  const fetchFiles = async () => {
    try {
      const token = getToken();
      const response = await axios.get('http://localhost:3001/api/files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const files = response.data.files;
      setAllFiles(files);
      
      // 设置当前文件为第一个文件
      if (files && files.length > 0 && !currentFile) {
        setCurrentFile(files[0]);
        return files[0];
      }
      return currentFile;
    } catch (error) {
      console.error('获取文件列表错误:', error);
      setMessage('获取文件列表失败');
      return null;
    }
  };

  const createFile = async (name) => {
    try {
      const token = getToken();
      const response = await axios.post('http://localhost:3001/api/files', {
        name: name
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const newFile = response.data.file;
      setAllFiles([...allFiles, newFile]);
      setCurrentFile(newFile);
      setMessage('文件创建成功！');
      return newFile;
    } catch (error) {
      console.error('创建文件错误:', error);
      const errorMsg = error.response?.data?.error || error.message || '创建文件失败';
      setMessage(`创建文件失败: ${errorMsg}`);
      return null;
    }
  };

  const updateFileName = async (fileId, newName) => {
    try {
      const token = getToken();
      await axios.put(`http://localhost:3001/api/files/${fileId}`, {
        name: newName
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setAllFiles(allFiles.map(f => 
        f.id === fileId ? { ...f, name: newName } : f
      ));
      
      if (currentFile && currentFile.id === fileId) {
        setCurrentFile({ ...currentFile, name: newName });
      }
      setMessage('文件重命名成功！');
    } catch (error) {
      setMessage('重命名文件失败');
    }
  };

  const deleteFile = async (fileId) => {
    if (allFiles.length <= 1) {
      setMessage('至少需要保留一个文件');
      return;
    }
    
    try {
      const token = getToken();
      await axios.delete(`http://localhost:3001/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const remainingFiles = allFiles.filter(f => f.id !== fileId);
      setAllFiles(remainingFiles);
      
      if (currentFile && currentFile.id === fileId && remainingFiles.length > 0) {
        setCurrentFile(remainingFiles[0]);
        fetchGoals(remainingFiles[0].id);
      }
      setMessage('文件删除成功！');
    } catch (error) {
      setMessage('删除文件失败');
    }
  };

  const switchToFile = async (file) => {
    setCurrentFile(file);
    setShowFileDropdown(false);
    await fetchGoals(file.id);
  };

  // 主题切换
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('darkMode', !isDarkMode);
  };

  // 双主题配置：盛夏晨曦 🌅 & 静谧海洋 🌊
  const theme = {
    summer: {
      background: '#FEF4DE',    // 温暖米白
      surface: '#FFE69D',       // 柔和金黄  
      text: '#5D4037',          // 深棕色文字
      textSecondary: '#8D6E63', // 中棕色次要文字
      border: '#FFB904',        // 橙黄色边框
      primary: '#FFB904',       // 明亮橙黄
      secondary: '#FF9302',     // 深橙色
      accent: '#FF9302',        // 深橙色强调
      name: '盛夏晨曦',
      icon: '🌅'
    },
    ocean: {
      background: '#E0FFDC',    // 清新薄荷绿
      surface: '#39E6F4',       // 天蓝色面板
      text: '#1A365D',          // 深海蓝文字
      textSecondary: '#2D5282', // 中海蓝次要文字  
      border: '#288CFF',        // 明亮海蓝边框
      primary: '#288CFF',       // 海蓝主按钮
      secondary: '#3C67DC',     // 深蓝次要按钮
      accent: '#3C67DC',        // 深蓝强调色
      name: '静谧海洋',
      icon: '🌊'
    }
  };
  
  const currentTheme = isDarkMode ? theme.ocean : theme.summer;

  // 构建树状结构数据并计算位置
  const buildTreeData = (goals) => {
    const goalMap = {};
    goals.forEach(goal => {
      goalMap[goal.id] = { ...goal, children: [] };
    });

    const rootGoals = [];
    goals.forEach(goal => {
      if (goal.parent_id && goalMap[goal.parent_id]) {
        goalMap[goal.parent_id].children.push(goalMap[goal.id]);
      } else if (!goal.parent_id) {
        rootGoals.push(goalMap[goal.id]);
      }
    });

    // 计算节点位置
    const calculatePositions = (nodes, level = 0, startY = 100) => {
      let currentY = startY;
      const nodeHeight = 80;
      const nodeSpacing = 20;
      const levelSpacing = 200;

      nodes.forEach(node => {
        node.x = 50 + level * levelSpacing;
        node.y = currentY;
        
        if (node.children && node.children.length > 0) {
          const childrenHeight = calculatePositions(node.children, level + 1, currentY);
          currentY = childrenHeight;
        } else {
          currentY += nodeHeight + nodeSpacing;
        }
      });

      return currentY;
    };

    calculatePositions(rootGoals);
    return rootGoals;
  };

  // 获取目标列表
  const fetchGoals = async (fileId = null) => {
    try {
      const token = getToken();
      const targetFileId = fileId || (currentFile && currentFile.id);
      
      if (!targetFileId) {
        // 没有文件ID时，清空目标列表
        setAllGoals([]);
        setTreeData([]);
        return;
      }
      
      const response = await axios.get(`http://localhost:3001/api/goals?file_id=${targetFileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const goals = response.data.goals;
      setAllGoals(goals);
      setTreeData(buildTreeData(goals));
    } catch (error) {
      console.error('获取目标错误:', error);
      setMessage('获取目标失败');
    }
  };

  // 创建新目标
  const handleAdd = async () => {
    if (!newGoalTitle.trim()) {
      setMessage('请输入目标标题');
      return;
    }

    if (!currentFile || !currentFile.id) {
      setMessage('请先选择一个文件');
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      await axios.post('http://localhost:3001/api/goals', {
        title: newGoalTitle,
        description: newGoalDescription,
        parent_id: selectedGoal?.id || null,
        file_id: currentFile.id
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setMessage(selectedGoal ? '子目标创建成功！' : '目标创建成功！');
      setNewGoalTitle('');
      setNewGoalDescription('');
      setShowAddDialog(false);
      fetchGoals();
    } catch (error) {
      setMessage('创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除目标
  const handleDelete = async () => {
    if (!selectedGoal || !window.confirm(`确定删除"${selectedGoal.title}"吗？`)) {
      return;
    }

    try {
      const token = getToken();
      await axios.delete(`http://localhost:3001/api/goals/${selectedGoal.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('删除成功！');
      setSelectedGoal(null);
      fetchGoals();
    } catch (error) {
      setMessage('删除失败');
    }
  };

  // 打开编辑对话框
  const handleEdit = () => {
    if (!selectedGoal) return;
    setEditGoalTitle(selectedGoal.title);
    setEditGoalDescription(selectedGoal.description || '');
    setShowEditDialog(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editGoalTitle.trim()) {
      setMessage('请输入目标标题');
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      await axios.put(`http://localhost:3001/api/goals/${selectedGoal.id}`, {
        title: editGoalTitle,
        description: editGoalDescription
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setMessage('编辑成功！');
      setEditGoalTitle('');
      setEditGoalDescription('');
      setShowEditDialog(false);
      fetchGoals();
    } catch (error) {
      setMessage('编辑失败');
    } finally {
      setLoading(false);
    }
  };

  // 画布拖拽
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 滚轮缩放（支持10倍放大）
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.2, Math.min(10, prev + delta)));
  };

  // 计算画布尺寸（根据节点位置）
  const calculateCanvasSize = (nodes) => {
    if (!nodes || nodes.length === 0) return { width: 800, height: 600 };
    
    let maxX = 0, maxY = 0;
    
    const getNodeBounds = (nodeList) => {
      nodeList.forEach(node => {
        maxX = Math.max(maxX, node.x + 120); // 节点宽度120
        maxY = Math.max(maxY, node.y + 60);  // 节点高度60
        if (node.children) {
          getNodeBounds(node.children);
        }
      });
    };
    
    getNodeBounds(nodes);
    
    return {
      width: Math.max(800, maxX + 200), // 至少800宽度，右边留200px边距
      height: Math.max(600, maxY + 200) // 至少600高度，底部留200px边距
    };
  };

  // 渲染所有节点和连线
  const renderAllNodes = (nodes) => {
    const elements = [];

    const processNode = (node) => {
      // 渲染连线到子节点（贝塞尔曲线）
      if (node.children) {
        node.children.forEach(child => {
          const startX = node.x + 120;
          const startY = node.y + 30;
          const endX = child.x;
          const endY = child.y + 30;
          
          // 计算贝塞尔曲线控制点
          const controlPoint1X = startX + (endX - startX) * 0.5;
          const controlPoint1Y = startY;
          const controlPoint2X = startX + (endX - startX) * 0.5;
          const controlPoint2Y = endY;
          
          const pathData = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;
          
          elements.push(
            <path
              key={`line-${node.id}-${child.id}`}
              d={pathData}
              stroke={currentTheme.border}
              strokeWidth="2"
              fill="none"
              opacity="0.6"
              style={{ pointerEvents: 'none' }}
            />
          );
          processNode(child);
        });
      }

      // 渲染节点
      elements.push(
        <g key={`node-${node.id}`}>
          {/* 节点阴影 */}
          <rect
            x={node.x + 2}
            y={node.y + 2}
            width="120"
            height="60"
            rx="12"
            fill="rgba(0,0,0,0.1)"
            style={{ pointerEvents: 'none' }}
          />
          {/* 节点背景 */}
          <rect
            x={node.x}
            y={node.y}
            width="120"
            height="60"
            rx="12"
            fill={selectedGoal?.id === node.id ? currentTheme.accent : currentTheme.surface}
            stroke={selectedGoal?.id === node.id ? currentTheme.primary : currentTheme.border}
            strokeWidth={selectedGoal?.id === node.id ? '3' : '2'}
            className={`node-rect ${selectedGoal?.id === node.id ? 'selected' : 'node-normal'}`}
            style={{ 
              cursor: 'pointer',
              transformOrigin: `${node.x + 60}px ${node.y + 30}px`
            }}
            onMouseEnter={(e) => {
              if (selectedGoal?.id !== node.id) {
                e.target.classList.add(isDarkMode ? 'node-hover-dark' : 'node-hover');
              }
            }}
            onMouseLeave={(e) => {
              e.target.classList.remove('node-hover', 'node-hover-dark');
            }}
            onClick={(e) => {
              e.target.classList.add('clicked');
              setTimeout(() => e.target.classList.remove('clicked'), 400);
              setSelectedGoal(selectedGoal?.id === node.id ? null : node);
            }}
          />
          {/* 节点文字 */}
          <text
            x={node.x + 60}
            y={node.y + 25}
            textAnchor="middle"
            fontSize="12"
            fontWeight={selectedGoal?.id === node.id ? '600' : '500'}
            fill={selectedGoal?.id === node.id ? '#fff' : currentTheme.text}
            className="node-text"
            style={{ pointerEvents: 'none' }}
          >
            {node.title.length > 10 ? node.title.substring(0, 10) + '...' : node.title}
          </text>
          {node.description && (
            <text
              x={node.x + 60}
              y={node.y + 40}
              textAnchor="middle"
              fontSize="10"
              fontWeight={selectedGoal?.id === node.id ? '500' : '400'}
              fill={selectedGoal?.id === node.id ? 'rgba(255,255,255,0.9)' : currentTheme.textSecondary}
              className="node-text"
              style={{ pointerEvents: 'none' }}
            >
              {node.description.length > 15 ? node.description.substring(0, 15) + '...' : node.description}
            </text>
          )}
          {/* 子节点数量 */}
          {node.children && node.children.length > 0 && (
            <text
              x={node.x + 60}
              y={node.y + 55}
              textAnchor="middle"
              fontSize="9"
              fill={currentTheme.textSecondary}
              style={{ pointerEvents: 'none' }}
            >
              {node.children.length} 个子目标
            </text>
          )}
        </g>
      );
    };

    nodes.forEach(processNode);
    return elements;
  };

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      const firstFile = await fetchFiles();
      if (firstFile) {
        await fetchGoals(firstFile.id);
      }
    };
    initializeData();
  }, []);

  // 当切换文件时重新获取目标
  useEffect(() => {
    if (currentFile && currentFile.id) {
      fetchGoals(currentFile.id);
    }
  }, [currentFile]);

  // 自动清除消息提示（但保留选中提示）
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 2500); // 2.5秒后自动清除
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = document.querySelector('.file-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        setShowFileDropdown(false);
      }
    };

    if (showFileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFileDropdown]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // 我的页面
  if (currentView === 'profile') {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return (
      <div style={{ height: 'calc(100vh - 60px)', overflow: 'auto', padding: '20px', backgroundColor: 'white' }}>
        <div style={{ textAlign: 'center', paddingTop: '50px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>👤</div>
          <h2>我的信息</h2>
          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginTop: '20px', maxWidth: '300px', margin: '20px auto' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>用户名:</strong> {user.username}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>邮箱:</strong> {user.email}
            </div>
            <div>
              <strong>目标总数:</strong> {allGoals.length} 个
            </div>
          </div>
          
          <button
            onClick={onLogout}
            style={{
              marginTop: '30px',
              padding: '12px 24px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            退出登录
          </button>
        </div>
        
        {/* 底部导航栏 */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: 'white',
          borderTop: '1px solid #ddd',
          display: 'flex',
          zIndex: 1000
        }}>
          <button
            onClick={() => setCurrentView('workspace')}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              color: '#666',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '20px' }}>🎯</div>
            <div>工作区</div>
          </button>
          <button
            onClick={() => setCurrentView('profile')}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              color: '#2196f3',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '20px' }}>👤</div>
            <div>我的</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', backgroundColor: currentTheme.background }}>
      {/* 顶部工具栏 */}
      <div style={{
        height: '70px',
        background: isDarkMode 
          ? 'linear-gradient(135deg, rgba(60, 103, 220, 0.95) 0%, rgba(88, 86, 214, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(255, 230, 157, 0.95) 0%, rgba(255, 183, 104, 0.95) 100%)',
        borderBottom: `2px solid ${currentTheme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 25px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(15px)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '18px',
          background: 'rgba(255,255,255,0.1)',
          padding: '10px 18px',
          borderRadius: '25px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={toggleTheme}
            className="theme-btn"
            style={{
              height: '42px',
              paddingLeft: '16px',
              paddingRight: '16px',
              borderRadius: '25px',
              border: 'none',
              background: isDarkMode 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: isDarkMode ? '#fff' : '#5D4037',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isDarkMode ? '0 4px 15px rgba(102, 126, 234, 0.3)' : '0 4px 15px rgba(255, 183, 104, 0.3)',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = isDarkMode ? '0 6px 25px rgba(102, 126, 234, 0.5)' : '0 6px 25px rgba(255, 183, 104, 0.5)';
              e.target.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = isDarkMode ? '0 4px 15px rgba(102, 126, 234, 0.3)' : '0 4px 15px rgba(255, 183, 104, 0.3)';
              e.target.style.filter = 'brightness(1)';
            }}
          >
            <span style={{ fontSize: '18px', transition: 'transform 0.3s ease' }}>{currentTheme.icon}</span>
            <span>{currentTheme.name}</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{
                height: '35px',
                width: 'auto',
                filter: isDarkMode ? 'brightness(1.2)' : 'none',
                transition: 'all 0.3s ease'
              }}
            />
            <h1 style={{ 
              margin: 0, 
              fontSize: '20px', 
              color: isDarkMode ? '#fff' : currentTheme.text,
              fontWeight: '700',
              textShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.1)',
              letterSpacing: '0.5px'
            }}>Loomorro</h1>
          </div>
        </div>
        
        {/* 中间提示信息区域 */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px'
        }}>
          {message && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
              color: message.includes('成功') ? '#155724' : '#721c24',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.3s ease',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {message}
            </div>
          )}
          
          {selectedGoal && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#e3f2fd',
              color: '#1976d2',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.3s ease',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              已选中: {selectedGoal.title}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {/* 显示当前缩放比例 */}
          <span style={{ fontSize: '12px', color: '#666' }}>{Math.round(scale * 100)}%</span>
          
          <button
            onClick={() => setShowAddDialog(true)}
            className="btn-fancy"
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #4caf50, #45a049)',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.target.style.animation = 'rotate 0.8s ease'}
            onAnimationEnd={(e) => e.target.style.animation = ''}
          >
            +
          </button>
          
          <button
            onClick={handleEdit}
            disabled={!selectedGoal}
            className="btn-fancy"
            style={{
              width: '48px',
              height: '48px',
              background: selectedGoal ? 'linear-gradient(135deg, #ff9800, #f57c00)' : '#ccc',
              color: 'white',
              fontSize: '18px',
              cursor: selectedGoal ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: selectedGoal ? 'none' : 'grayscale(100%)'
            }}
            onMouseEnter={(e) => selectedGoal && (e.target.style.animation = 'hammer 0.6s ease')}
            onAnimationEnd={(e) => e.target.style.animation = ''}
          >
            🔨
          </button>
          
          <button
            onClick={handleDelete}
            disabled={!selectedGoal}
            className="btn-fancy"
            style={{
              width: '48px',
              height: '48px',
              background: selectedGoal ? 'linear-gradient(135deg, #f44336, #d32f2f)' : '#ccc',
              color: 'white',
              fontSize: '18px',
              cursor: selectedGoal ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: selectedGoal ? 'none' : 'grayscale(100%)'
            }}
            onMouseEnter={(e) => selectedGoal && (e.target.style.animation = 'pulse 0.4s ease')}
            onAnimationEnd={(e) => e.target.style.animation = ''}
          >
            💀
          </button>
          
          {/* 文件管理按钮 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFileDropdown(!showFileDropdown)}
              className="btn-fancy"
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #9c27b0, #673ab7)',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.target.style.animation = 'pulse 0.4s ease'}
              onAnimationEnd={(e) => e.target.style.animation = ''}
            >
              📁
            </button>
            
            {/* 文件下拉菜单 */}
            {showFileDropdown && (
              <div 
                className="file-dropdown"
                style={{
                  position: 'absolute',
                  top: '55px',
                  right: '0',
                  minWidth: '250px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, rgba(60, 103, 220, 0.95) 0%, rgba(88, 86, 214, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(255, 230, 157, 0.95) 0%, rgba(255, 183, 104, 0.95) 100%)',
                  backdropFilter: 'blur(15px)',
                  borderRadius: '15px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  zIndex: 1000,
                  padding: '10px',
                  animation: 'slideDown 0.3s ease'
                }}
              >
                {/* 文件列表标题 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <span style={{
                    color: isDarkMode ? '#fff' : currentTheme.text,
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>📁 文件管理</span>
                  <button
                    onClick={async () => {
                      const fileName = prompt('请输入文件名:');
                      if (fileName && fileName.trim()) {
                        await createFile(fileName.trim());
                      }
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '4px 8px',
                      color: isDarkMode ? '#fff' : currentTheme.text,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    + 新建
                  </button>
                </div>
                
                {/* 文件列表 */}
                {allFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      marginBottom: '5px',
                      borderRadius: '10px',
                      background: currentFile?.id === file.id 
                        ? 'rgba(255,255,255,0.3)' 
                        : 'rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentFile?.id !== file.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentFile?.id !== file.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    onClick={() => switchToFile(file)}
                  >
                    <span style={{
                      color: isDarkMode ? '#fff' : currentTheme.text,
                      fontSize: '13px',
                      fontWeight: currentFile?.id === file.id ? '600' : '500',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {currentFile?.id === file.id ? '✅ ' : '📄 '}{file.name}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newName = prompt('请输入新文件名:', file.name);
                          if (newName && newName.trim() && newName.trim() !== file.name) {
                            updateFileName(file.id, newName.trim());
                          }
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          color: isDarkMode ? '#fff' : currentTheme.text,
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️
                      </button>
                      
                      {allFiles.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确认删除文件 "${file.name}" 吗？`)) {
                              deleteFile(file.id);
                            }
                          }}
                          style={{
                            background: 'rgba(255,0,0,0.3)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            color: '#fff',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* 节点式画布 */}
      <div
        ref={canvasRef}
        style={{
          height: 'calc(100vh - 130px)',
          background: isDarkMode 
            ? `radial-gradient(circle at 30% 40%, rgba(120, 119, 198, 0.15), transparent 70%), ${currentTheme.background}`
            : `radial-gradient(circle at 30% 40%, rgba(255, 183, 104, 0.1), transparent 70%), ${currentTheme.background}`,
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative',
          borderRadius: '15px',
          margin: '10px',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)'
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {treeData.length === 0 ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌱</div>
            <p>还没有目标节点</p>
            <p>点击右上角 + 号创建第一个目标节点！</p>
          </div>
        ) : (
          <svg
            width={calculateCanvasSize(treeData).width}
            height={calculateCanvasSize(treeData).height}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              display: 'block'
            }}
          >
            {renderAllNodes(treeData)}
          </svg>
        )}
      </div>

      {/* 底部导航栏 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: currentTheme.surface,
        borderTop: `1px solid ${currentTheme.border}`,
        display: 'flex',
        zIndex: 1000
      }}>
        <button
          onClick={() => setCurrentView('workspace')}
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '14px',
            color: '#2196f3',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ fontSize: '20px' }}>🎯</div>
          <div>工作区</div>
        </button>
        <button
          onClick={() => setCurrentView('profile')}
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '14px',
            color: '#666',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ fontSize: '20px' }}>👤</div>
          <div>我的</div>
        </button>
      </div>

      {/* 添加目标对话框 */}
      {showAddDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>
              {selectedGoal ? `为"${selectedGoal.title}"添加子目标` : '创建新目标'}
            </h3>
            
            <input
              type="text"
              placeholder="目标标题"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            
            <textarea
              placeholder="目标描述（可选）"
              value={newGoalDescription}
              onChange={(e) => setNewGoalDescription(e.target.value)}
              rows="3"
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '20px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewGoalTitle('');
                  setNewGoalDescription('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑目标对话框 */}
      {showEditDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>
              编辑目标
            </h3>
            
            <input
              type="text"
              placeholder="目标标题"
              value={editGoalTitle}
              onChange={(e) => setEditGoalTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            
            <textarea
              placeholder="目标描述（可选）"
              value={editGoalDescription}
              onChange={(e) => setEditGoalDescription(e.target.value)}
              rows="3"
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '20px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditGoalTitle('');
                  setEditGoalDescription('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  backgroundColor: '#ff9800',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;