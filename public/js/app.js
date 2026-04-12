// 全局状态
let currentAccountId = null;
let authTimer = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadAccounts();
  loadLogs();

  // 事件绑定
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  document.getElementById('addAccountForm').addEventListener('submit', handleAddAccount);
  document.getElementById('checkTokenBtn').addEventListener('click', checkToken);
  document.getElementById('refreshAllTokens').addEventListener('click', refreshAllTokens);
});

// ==================== 数据加载 ====================

async function loadStats() {
  try {
    const response = await fetch('/api/accounts/stats');
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('totalAccounts').textContent = result.data.total;
      document.getElementById('activeAccounts').textContent = result.data.active;
      document.getElementById('expiredAccounts').textContent = result.data.expired;
      document.getElementById('totalRequests').textContent = result.data.totalRequests || 0;
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

async function loadAccounts() {
  try {
    const response = await fetch('/api/accounts');
    const result = await response.json();
    
    if (result.success) {
      renderAccounts(result.data);
    }
  } catch (error) {
    console.error('加载账号失败:', error);
  }
}

async function loadLogs() {
  try {
    const response = await fetch('/api/system/logs?limit=20');
    const result = await response.json();
    
    if (result.success) {
      renderLogs(result.data);
    }
  } catch (error) {
    console.error('加载日志失败:', error);
  }
}

// ==================== 渲染函数 ====================

function renderAccounts(accounts) {
  const container = document.getElementById('accountsList');
  
  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<p class="empty-state">暂无账号，请添加新账号</p>';
    return;
  }

  container.innerHTML = accounts.map(account => {
    const statusClass = `status-${account.status}`;
    const statusText = getStatusText(account.status);
    const isActive = account.is_active;
    const expiresAt = account.expires_at ? new Date(account.expires_at).toLocaleString('zh-CN') : '未知';
    const isExpired = account.expires_at && new Date(account.expires_at) <= new Date();

    return `
      <div class="account-card" data-id="${account.id}">
        <div class="account-info">
          <h3>
            ${escapeHtml(account.name)}
            <span class="status-badge ${statusClass}">${statusText}</span>
            ${!isActive ? '<span class="status-badge status-error">已停用</span>' : ''}
          </h3>
          <div class="account-meta">
            <span>📊 请求数: ${account.request_count || 0}</span>
            <span>⏰ 过期时间: ${expiresAt}</span>
            ${isExpired ? '<span style="color: var(--danger);">⚠️ 已过期</span>' : ''}
          </div>
        </div>
        <div class="account-actions">
          ${account.status === 'pending' ? `
            <button class="btn btn-primary" onclick="checkTokenForAccount(${account.id})">检查 Token</button>
          ` : ''}
          ${account.status === 'active' && !isExpired ? `
            <button class="btn btn-secondary" onclick="refreshToken(${account.id})">刷新 Token</button>
          ` : ''}
          <button class="btn ${isActive ? 'btn-secondary' : 'btn-success'}" onclick="toggleAccount(${account.id})">
            ${isActive ? '停用' : '启用'}
          </button>
          <button class="btn btn-danger" onclick="deleteAccount(${account.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderLogs(logs) {
  const container = document.getElementById('logsList');
  
  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="empty-state">暂无请求日志</p>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const statusCode = log.status_code || 500;
    const statusClass = `log-${statusCode >= 500 ? '500' : statusCode >= 400 ? '400' : '200'}`;
    const time = new Date(log.created_at).toLocaleString('zh-CN');

    return `
      <div class="log-entry">
        <div class="log-info">
          <div class="log-account">${escapeHtml(log.account_name || '未知账号')}</div>
          <div class="log-details">
            模型: ${escapeHtml(log.model || '未知')} | 
            端点: ${escapeHtml(log.endpoint || '未知')} | 
            耗时: ${log.response_time}ms
          </div>
        </div>
        <div class="log-status">
          <span class="log-status-code ${statusClass}">${statusCode}</span>
          <div class="log-time">${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 操作函数 ====================

async function handleAddAccount(event) {
  event.preventDefault();
  
  const nameInput = document.getElementById('accountName');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('请输入账号名称');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';

  try {
    const response = await fetch('/api/accounts/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const result = await response.json();

    if (result.success) {
      currentAccountId = result.data.accountId;
      
      // 显示授权状态
      const authStatus = document.getElementById('authStatus');
      authStatus.style.display = 'block';
      
      document.getElementById('authLink').href = result.data.verificationUriComplete;
      document.getElementById('authLink').textContent = result.data.verificationUriComplete;
      document.getElementById('userCode').textContent = result.data.userCode;
      
      // 启动倒计时
      startCountdown(result.data.expiresIn);
      
      nameInput.value = '';
    } else {
      alert('添加账号失败: ' + result.message);
    }
  } catch (error) {
    alert('添加账号失败: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发起授权';
  }
}

async function checkToken() {
  if (!currentAccountId) {
    alert('请先添加账号');
    return;
  }

  await checkTokenForAccount(currentAccountId);
}

async function checkTokenForAccount(accountId) {
  const btn = document.getElementById('checkTokenBtn');
  btn.disabled = true;
  btn.textContent = '检查中...';

  try {
    const response = await fetch(`/api/accounts/${accountId}/check-token`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 授权成功！Token 已保存');
      document.getElementById('authStatus').style.display = 'none';
      
      // 刷新列表
      loadStats();
      loadAccounts();
    } else {
      alert('检查失败: ' + result.message);
    }
  } catch (error) {
    alert('检查失败: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '检查授权状态';
  }
}

async function refreshToken(accountId) {
  if (!confirm('确定要刷新此账号的 Token 吗？')) {
    return;
  }

  try {
    const response = await fetch(`/api/accounts/${accountId}/refresh`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ Token 刷新成功');
      loadAccounts();
    } else {
      alert('刷新失败: ' + result.message);
      if (result.needReauth) {
        alert('需要重新授权，请删除后重新添加此账号');
      }
    }
  } catch (error) {
    alert('刷新失败: ' + error.message);
  }
}

async function refreshAllTokens() {
  if (!confirm('确定要刷新所有即将过期的 Token 吗？')) {
    return;
  }

  try {
    const response = await fetch('/api/accounts/refresh-all', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ 批量刷新完成\n成功: ${result.data.successCount} 个\n失败: ${result.data.failCount} 个`);
      loadStats();
      loadAccounts();
    } else {
      alert('批量刷新失败: ' + result.message);
    }
  } catch (error) {
    alert('批量刷新失败: ' + error.message);
  }
}

async function toggleAccount(accountId) {
  try {
    const response = await fetch(`/api/accounts/${accountId}/toggle`, {
      method: 'PATCH'
    });

    const result = await response.json();

    if (result.success) {
      loadAccounts();
      loadStats();
    } else {
      alert('操作失败: ' + result.message);
    }
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function deleteAccount(accountId) {
  if (!confirm('确定要删除此账号吗？此操作不可撤销。')) {
    return;
  }

  try {
    const response = await fetch(`/api/accounts/${accountId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ 账号已删除');
      loadStats();
      loadAccounts();
    } else {
      alert('删除失败: ' + result.message);
    }
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

async function refreshAll() {
  loadStats();
  loadAccounts();
  loadLogs();
}

// ==================== 辅助函数 ====================

function startCountdown(expiresIn) {
  let remaining = expiresIn;
  
  const updateCountdown = () => {
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    document.getElementById('countdown').textContent = 
      `${minutes}分${seconds}秒`;
    
    if (remaining > 0) {
      remaining--;
    } else {
      clearInterval(authTimer);
      document.getElementById('countdown').textContent = '已过期';
    }
  };

  updateCountdown();
  authTimer = setInterval(updateCountdown, 1000);
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待授权',
    'active': '活跃',
    'expired': '已过期',
    'error': '错误'
  };
  return statusMap[status] || status;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
