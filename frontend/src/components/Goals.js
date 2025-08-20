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
  
  // 画布相关状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // 获取token
  const getToken = () => localStorage.getItem('token');

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
  const fetchGoals = async () => {
    try {
      const token = getToken();
      const response = await axios.get('http://localhost:3001/api/goals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const goals = response.data.goals;
      setAllGoals(goals);
      setTreeData(buildTreeData(goals));
    } catch (error) {
      setMessage('获取目标失败');
    }
  };

  // 创建新目标
  const handleAdd = async () => {
    if (!newGoalTitle.trim()) {
      setMessage('请输入目标标题');
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      await axios.post('http://localhost:3001/api/goals', {
        title: newGoalTitle,
        description: newGoalDescription,
        parent_id: selectedGoal?.id || null
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

  // 滚轮缩放
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // 渲染所有节点和连线
  const renderAllNodes = (nodes) => {
    const elements = [];

    const processNode = (node) => {
      // 渲染连线到子节点
      if (node.children) {
        node.children.forEach(child => {
          elements.push(
            <line
              key={`line-${node.id}-${child.id}`}
              x1={node.x + 120}
              y1={node.y + 30}
              x2={child.x}
              y2={child.y + 30}
              stroke="#ddd"
              strokeWidth="2"
            />
          );
          processNode(child);
        });
      }

      // 渲染节点
      elements.push(
        <g key={`node-${node.id}`}>
          {/* 节点背景 */}
          <rect
            x={node.x}
            y={node.y}
            width="120"
            height="60"
            rx="8"
            fill={selectedGoal?.id === node.id ? '#e3f2fd' : 'white'}
            stroke={selectedGoal?.id === node.id ? '#2196f3' : '#ddd'}
            strokeWidth={selectedGoal?.id === node.id ? '2' : '1'}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedGoal(selectedGoal?.id === node.id ? null : node)}
          />
          {/* 节点文字 */}
          <text
            x={node.x + 60}
            y={node.y + 25}
            textAnchor="middle"
            fontSize="12"
            fill="#333"
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
              fill="#666"
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
              fill="#999"
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchGoals();
  }, []);

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
    <div style={{ height: '100vh', backgroundColor: 'white' }}>
      {/* 顶部工具栏 */}
      <div style={{
        height: '60px',
        backgroundColor: 'white',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', color: '#333' }}>🌳 Loomorro</h1>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {/* 显示当前缩放比例 */}
          <span style={{ fontSize: '12px', color: '#666' }}>{Math.round(scale * 100)}%</span>
          
          <button
            onClick={() => setShowAddDialog(true)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#4caf50',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            +
          </button>
          
          <button
            onClick={handleEdit}
            disabled={!selectedGoal}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: selectedGoal ? '#ff9800' : '#ccc',
              color: 'white',
              fontSize: '16px',
              cursor: selectedGoal ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            🔨
          </button>
          
          <button
            onClick={handleDelete}
            disabled={!selectedGoal}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: selectedGoal ? '#f44336' : '#ccc',
              color: 'white',
              fontSize: '16px',
              cursor: selectedGoal ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '20px',
          right: '20px',
          padding: '10px',
          backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 200
        }}>
          {message}
        </div>
      )}

      {/* 选中提示 */}
      {selectedGoal && (
        <div style={{
          position: 'absolute',
          top: message ? '110px' : '70px',
          left: '20px',
          right: '20px',
          padding: '10px',
          backgroundColor: '#e3f2fd',
          color: '#1976d2',
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 200
        }}>
          已选中: {selectedGoal.title}
        </div>
      )}

      {/* 节点式画布 */}
      <div
        ref={canvasRef}
        style={{
          height: 'calc(100vh - 120px)',
          backgroundColor: 'white',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative'
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
            width="100%"
            height="100%"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: '0 0'
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