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
    
    if (token && savedUser) {
      setIsLoggedIn(true);
      setUser(JSON.parse(savedUser));
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
