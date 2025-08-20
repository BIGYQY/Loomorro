import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true); // true=登录模式, false=注册模式
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');

  // 处理登录
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/login', {
        email,
        password
      });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setMessage('登录成功！');
      onLogin(token, user);
      
    } catch (error) {
      setMessage(error.response?.data?.error || '登录失败');
    }
  };

  // 处理注册
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // eslint-disable-next-line no-unused-vars
      const response = await axios.post('http://localhost:3001/api/register', {
        email,
        password,
        username
      });
      
      setMessage('注册成功！请登录');
      setIsLogin(true);
      
    } catch (error) {
      setMessage(error.response?.data?.error || '注册失败');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>{isLogin ? '登录 Loommorro' : '注册 Loommorro'}</h2>
      
      <form onSubmit={isLogin ? handleLogin : handleRegister}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          />
        </div>
        
        {!isLogin && (
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            />
          </div>
        )}
        
        <button 
          type="submit" 
          style={{ 
            width: '100%', 
            padding: '12px', 
            fontSize: '16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer' 
          }}
        >
          {isLogin ? '登录' : '注册'}
        </button>
      </form>
      
      <p style={{ textAlign: 'center', marginTop: '15px' }}>
        {isLogin ? '没有账号？' : '已有账号？'}
        <button 
          onClick={() => setIsLogin(!isLogin)}
          style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}
        >
          {isLogin ? '立即注册' : '立即登录'}
        </button>
      </p>
      
      {message && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default Login;