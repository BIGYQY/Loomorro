import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Goals from './components/Goals';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [user, setUser] = useState(null);

  // 检查本地存储是否有token
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    // 验证token是否有效
    if (token) {
      try {
        // 检查token是否过期
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (payload.exp && payload.exp < currentTime) {
          // Token过期，清除数据
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoggedIn(false);
          return;
        }
        
        if (savedUser) {
          setIsLoggedIn(true);
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        // Token解析失败，清除数据
        console.error('Token解析失败:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  // 处理登录成功
  const handleLogin = (token, userData) => {
    setIsLoggedIn(true);
    setUser(userData);
  };

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="App">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="App">
      <Goals onLogout={handleLogout} />
    </div>
  );
}

export default App;
