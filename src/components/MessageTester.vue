<template>
  <div class="message-tester">
    <n-card
      title="消息加解密测试"
      class="mb-4"
    >
      <div class="space-y-4">
        <!-- 选择Token -->
        <div>
          <n-select
            v-model:value="selectedTokenId"
            :options="tokenOptions"
            placeholder="选择要测试的Token"
            class="w-full"
          />
        </div>

        <!-- WebSocket连接状态 -->
        <div v-if="selectedTokenId">
          <n-tag :type="wsStatusType">
            {{ wsStatusText }}
          </n-tag>
          <n-button 
            v-if="wsStatus !== 'connected'" 
            type="primary"
            size="small"
            class="ml-2"
            @click="connectWebSocket"
          >
            连接WebSocket
          </n-button>
        </div>

        <!-- 预设消息测试 -->
        <n-divider title-placement="left">
          预设消息测试
        </n-divider>
        <div class="grid grid-cols-2 gap-2">
          <n-button
            :disabled="!canSendMessage"
            @click="sendHeartbeat"
          >
            💗 发送心跳
          </n-button>
          <n-button
            :disabled="!canSendMessage"
            @click="sendGetRoleInfo"
          >
            👤 获取角色信息
          </n-button>
          <n-button
            :disabled="!canSendMessage"
            @click="sendGetDataVersion"
          >
            📦 获取数据版本
          </n-button>
          <n-button
            :disabled="!canSendMessage"
            @click="sendSignIn"
          >
            📅 签到
          </n-button>
        </div>

        <!-- 自定义消息发送 -->
        <n-divider title-placement="left">
          自定义消息
        </n-divider>
        <div class="space-y-2">
          <n-input
            v-model:value="customCmd"
            placeholder="命令 (例如: role_getroleinfo)"
            class="w-full"
          />
          <n-input
            v-model:value="customBody"
            type="textarea"
            placeholder="消息体 JSON (例如: {&quot;clientVersion&quot;: &quot;1.65.3-wx&quot;})"
            :rows="3"
            class="w-full"
          />
          <n-button 
            :disabled="!canSendMessage || !customCmd" 
            type="primary"
            @click="sendCustomMessage"
          >
            🚀 发送自定义消息
          </n-button>
        </div>

        <!-- 消息历史 -->
        <n-divider title-placement="left">
          消息历史
        </n-divider>
        <div class="message-history max-h-96 overflow-y-auto">
          <div 
            v-for="(message, index) in messageHistory" 
            :key="index"
            class="message-item p-3 mb-2 rounded border"
            :class="message.type === 'sent' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold">
                {{ message.type === 'sent' ? '📤 发送' : '📨 接收' }}
                <span class="text-sm text-gray-500 ml-2">{{ formatTime(message.timestamp) }}</span>
              </span>
            </div>
            
            <div
              v-if="message.cmd"
              class="text-sm"
            >
              <strong>命令:</strong> {{ message.cmd }}
            </div>
            
            <div class="mt-2">
              <n-collapse>
                <n-collapse-item
                  title="查看详细数据"
                  name="detail"
                >
                  <pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto">{{ formatJSON(message.data) }}</pre>
                </n-collapse-item>
              </n-collapse>
            </div>
          </div>
          
          <div
            v-if="messageHistory.length === 0"
            class="text-center text-gray-500"
          >
            暂无消息历史
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTokenStore } from '../stores/tokenStore'
import { useGameRolesStore } from '../stores/gameRoles'
import { useMessage } from 'naive-ui'

const tokenStore = useTokenStore()
const gameRolesStore = useGameRolesStore()
const message = useMessage()

// 响应式数据
const selectedTokenId = ref(null)
const customCmd = ref('')
const customBody = ref('{}')
const messageHistory = ref([])

// 计算属性
const tokenOptions = computed(() => {
  return gameRolesStore.gameRoles.map(role => ({
    label: role.name,
    value: role.id
  }))
})

const wsStatus = computed(() => {
  return selectedTokenId.value ? tokenStore.getWebSocketStatus(selectedTokenId.value) : 'disconnected'
})

const wsStatusType = computed(() => {
  switch (wsStatus.value) {
    case 'connected': return 'success'
    case 'connecting': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
})

const wsStatusText = computed(() => {
  switch (wsStatus.value) {
    case 'connected': return '🟢 已连接'
    case 'connecting': return '🟡 连接中'
    case 'error': return '🔴 连接错误'
    default: return '⚪ 未连接'
  }
})

const canSendMessage = computed(() => {
  return selectedTokenId.value && wsStatus.value === 'connected'
})

// 方法
const connectWebSocket = () => {
  if (!selectedTokenId.value) return
  
  const role = gameRolesStore.gameRoles.find(r => r.id === selectedTokenId.value)
  if (role) {
    gameRolesStore.selectRole(role)
    message.success('正在建立WebSocket连接...')
  }
}

const addToHistory = (type, data, cmd = null) => {
  messageHistory.value.unshift({
    type,
    timestamp: new Date().toISOString(),
    cmd,
    data
  })
  
  // 保持历史记录在合理范围内
  if (messageHistory.value.length > 50) {
    messageHistory.value = messageHistory.value.slice(0, 50)
  }
}

const sendHeartbeat = () => {
  if (!canSendMessage.value) return
  
  const success = tokenStore.sendHeartbeat(selectedTokenId.value)
  if (success) {
    addToHistory('sent', { cmd: '_sys/ack' }, '_sys/ack')
    message.success('心跳消息已发送')
  } else {
    message.error('心跳消息发送失败')
  }
}

const sendGetRoleInfo = () => {
  if (!canSendMessage.value) return
  
  const success = tokenStore.sendGetRoleInfo(selectedTokenId.value)
  if (success) {
    addToHistory('sent', { cmd: 'role_getroleinfo' }, 'role_getroleinfo')
    message.success('角色信息请求已发送')
  } else {
    message.error('角色信息请求发送失败')
  }
}

const sendGetDataVersion = () => {
  if (!canSendMessage.value) return
  
  const success = tokenStore.sendGameMessage(selectedTokenId.value, 'system_getdatabundlever', { isAudit: false })
  if (success) {
    addToHistory('sent', { cmd: 'system_getdatabundlever' }, 'system_getdatabundlever')
    message.success('数据版本请求已发送')
  } else {
    message.error('数据版本请求发送失败')
  }
}

const sendSignIn = () => {
  if (!canSendMessage.value) return
  
  const success = tokenStore.sendGameMessage(selectedTokenId.value, 'system_signinreward', {})
  if (success) {
    addToHistory('sent', { cmd: 'system_signinreward' }, 'system_signinreward')
    message.success('签到请求已发送')
  } else {
    message.error('签到请求发送失败')
  }
}

const sendCustomMessage = () => {
  if (!canSendMessage.value || !customCmd.value) return
  
  try {
    const body = JSON.parse(customBody.value || '{}')
    const success = tokenStore.sendGameMessage(selectedTokenId.value, customCmd.value, body)
    
    if (success) {
      addToHistory('sent', { cmd: customCmd.value, body }, customCmd.value)
      message.success(`自定义消息 ${customCmd.value} 已发送`)
      
      // 清空输入
      customCmd.value = ''
      customBody.value = '{}'
    } else {
      message.error('自定义消息发送失败')
    }
  } catch (error) {
    message.error('消息体JSON格式错误: ' + error.message)
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatJSON = (data) => {
  return JSON.stringify(data, null, 2)
}

// 监听WebSocket消息（模拟，实际需要在tokenStore中触发事件）
watch(() => tokenStore.wsConnections, (connections) => {
  if (!selectedTokenId.value || !connections[selectedTokenId.value]) return
  
  const connection = connections[selectedTokenId.value]
  if (connection.lastMessage) {
    const lastMessage = connection.lastMessage
    addToHistory('received', lastMessage.parsed, lastMessage.parsed?.cmd)
  }
}, { deep: true })
</script>

<style scoped>
.message-tester {
  max-width: 800px;
  margin: 0 auto;
}

.message-item {
  transition: all 0.2s ease;
}

.message-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>