<template>
  <div class="token-manager">
    <div class="header">
      <h3>Token管理器</h3>
      <div class="header-actions">
        <n-button
          size="small"
          @click="refreshTokens"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button
          size="small"
          type="warning"
          @click="exportTokens"
        >
          <template #icon>
            <n-icon><Download /></n-icon>
          </template>
          导出
        </n-button>
        <n-upload 
          :show-file-list="false"
          accept=".json"
          @change="importTokens"
        >
          <n-button
            size="small"
            type="info"
          >
            <template #icon>
              <n-icon><CloudUpload /></n-icon>
            </template>
            导入
          </n-button>
        </n-upload>
      </div>
    </div>

    <!-- 用户Token -->
    <div class="token-section">
      <h4>用户认证Token</h4>
      <div
        v-if="localTokenStore.userToken"
        class="token-item"
      >
        <div class="token-info">
          <span class="token-label">Token:</span>
          <span class="token-value">{{ maskToken(localTokenStore.userToken) }}</span>
        </div>
        <n-button
          size="tiny"
          type="error"
          @click="clearUserToken"
        >
          清除
        </n-button>
      </div>
      <div
        v-else
        class="empty-token"
      >
        <span>未设置用户Token</span>
      </div>
    </div>

    <!-- 游戏Token列表 -->
    <div class="token-section">
      <h4>游戏角色Token ({{ Object.keys(localTokenStore.gameTokens).length }}个)</h4>
      <div class="game-tokens-list">
        <div 
          v-for="(tokenData, roleId) in localTokenStore.gameTokens"
          :key="roleId"
          class="game-token-item"
        >
          <div class="token-header">
            <div class="role-info">
              <span class="role-name">{{ tokenData.roleName }}</span>
              <span class="role-server">{{ tokenData.server }}</span>
            </div>
            <div class="token-actions">
              <n-button 
                size="tiny" 
                :type="getWSStatus(roleId) === 'connected' ? 'success' : 'default'"
                @click="toggleWebSocket(roleId, tokenData)"
              >
                {{ getWSStatus(roleId) === 'connected' ? '断开WS' : '连接WS' }}
              </n-button>
              <n-button 
                size="tiny" 
                type="warning"
                @click="regenerateToken(roleId)"
              >
                重生成
              </n-button>
              <n-button 
                size="tiny" 
                type="error"
                @click="removeToken(roleId)"
              >
                删除
              </n-button>
            </div>
          </div>
          
          <div class="token-details">
            <div class="detail-item">
              <span class="detail-label">Token:</span>
              <span class="detail-value">{{ maskToken(tokenData.token) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">WebSocket URL:</span>
              <span class="detail-value">{{ tokenData.wsUrl }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">创建时间:</span>
              <span class="detail-value">{{ formatTime(tokenData.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">最后使用:</span>
              <span class="detail-value">{{ formatTime(tokenData.lastUsed) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">连接状态:</span>
              <n-tag 
                size="small"
                :type="getWSStatusType(getWSStatus(roleId))"
              >
                {{ getWSStatusText(getWSStatus(roleId)) }}
              </n-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量操作 -->
    <div class="bulk-actions">
      <n-button
        type="warning"
        @click="cleanExpiredTokens"
      >
        清理过期Token
      </n-button>
      <n-button
        type="error"
        @click="clearAllTokens"
      >
        清除所有Token
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { useLocalTokenStore } from '@/stores/localTokenManager'
import { useGameRolesStore } from '@/stores/gameRoles'
import { 
  Refresh, 
  Download, 
  CloudUpload
} from '@vicons/ionicons5'

const message = useMessage()
const dialog = useDialog()
const localTokenStore = useLocalTokenStore()
const gameRolesStore = useGameRolesStore()

// 方法
const maskToken = (token) => {
  if (!token) return ''
  const len = token.length
  if (len <= 8) return token
  return token.substring(0, 4) + '***' + token.substring(len - 4)
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getWSStatus = (roleId) => {
  return localTokenStore.getWebSocketStatus(roleId)
}

const getWSStatusType = (status) => {
  switch (status) {
    case 'connected': return 'success'
    case 'error': return 'error'
    case 'connecting': return 'warning'
    default: return 'default'
  }
}

const getWSStatusText = (status) => {
  switch (status) {
    case 'connected': return '已连接'
    case 'error': return '连接错误'
    case 'connecting': return '连接中'
    default: return '未连接'
  }
}

const refreshTokens = () => {
  localTokenStore.initTokenManager()
  message.success('Token数据已刷新')
}

const clearUserToken = () => {
  dialog.warning({
    title: '清除用户Token',
    content: '确定要清除用户认证Token吗？这将会退出登录。',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      localTokenStore.clearUserToken()
      message.success('用户Token已清除')
    }
  })
}

const toggleWebSocket = (roleId, tokenData) => {
  const status = getWSStatus(roleId)
  
  if (status === 'connected') {
    localTokenStore.closeWebSocketConnection(roleId)
    message.info('WebSocket连接已断开')
  } else {
    try {
      localTokenStore.createWebSocketConnection(roleId, tokenData.token, tokenData.wsUrl)
      message.success('正在建立WebSocket连接...')
    } catch (error) {
      message.error('建立WebSocket连接失败')
    }
  }
}

const regenerateToken = (roleId) => {
  dialog.info({
    title: '重新生成Token',
    content: '确定要为此角色重新生成游戏Token吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const oldTokenData = localTokenStore.getGameToken(roleId)
      if (oldTokenData) {
        const newToken = 'game_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16)
        localTokenStore.updateGameToken(roleId, {
          token: newToken,
          regeneratedAt: new Date().toISOString()
        })
        message.success('Token已重新生成')
      }
    }
  })
}

const removeToken = (roleId) => {
  dialog.warning({
    title: '删除Token',
    content: '确定要删除此角色的游戏Token吗？这将断开相关的WebSocket连接。',
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: () => {
      localTokenStore.removeGameToken(roleId)
      message.success('Token已删除')
    }
  })
}

const exportTokens = () => {
  try {
    const tokenData = localTokenStore.exportTokens()
    const dataStr = JSON.stringify(tokenData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    const link = document.createElement('a')
    link.href = URL.createObjectURL(dataBlob)
    link.download = `tokens_backup_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    message.success('Token数据已导出')
  } catch (error) {
    message.error('导出失败: ' + error.message)
  }
}

const importTokens = ({ file }) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const tokenData = JSON.parse(e.target.result)
      const result = localTokenStore.importTokens(tokenData)
      
      if (result.success) {
        message.success(result.message)
        // 刷新游戏角色数据
        gameRolesStore.fetchGameRoles()
      } else {
        message.error(result.message)
      }
    } catch (error) {
      message.error('导入失败：文件格式错误')
    }
  }
  reader.readAsText(file.file)
}

const cleanExpiredTokens = () => {
  dialog.info({
    title: '清理过期Token',
    content: '确定要清理超过24小时未使用的Token吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const cleanedCount = localTokenStore.cleanExpiredTokens()
      message.success(`已清理 ${cleanedCount} 个过期Token`)
    }
  })
}

const clearAllTokens = () => {
  dialog.error({
    title: '清除所有Token',
    content: '确定要清除所有游戏Token吗？这将断开所有WebSocket连接。此操作不可恢复！',
    positiveText: '确定清除',
    negativeText: '取消',
    onPositiveClick: () => {
      localTokenStore.clearAllGameTokens()
      message.success('所有游戏Token已清除')
    }
  })
}
</script>

<style scoped lang="scss">
.token-manager {
  background: white;
  border-radius: var(--border-radius-large);
  padding: var(--spacing-lg);
  margin: var(--spacing-lg) 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  
  h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-lg);
  }
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.token-section {
  margin-bottom: var(--spacing-lg);
  
  h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.token-info {
  display: flex;
  gap: var(--spacing-md);
}

.token-label {
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.token-value {
  font-family: monospace;
  color: var(--text-primary);
}

.empty-token {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.game-tokens-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.game-token-item {
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.role-name {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.role-server {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.token-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.token-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.detail-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.detail-value {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-family: monospace;
  word-break: break-all;
}

.bulk-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-light);
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }
  
  .token-item {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }
  
  .token-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: stretch;
  }
  
  .token-details {
    grid-template-columns: 1fr;
  }
  
  .bulk-actions {
    flex-direction: column;
  }
}
</style>