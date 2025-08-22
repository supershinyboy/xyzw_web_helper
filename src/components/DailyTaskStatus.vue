<template>
  <div class="daily-task-container">
    <div class="task-header">
      <div class="header-left">
        <img src="/icons/174023274867420.png" alt="每日任务" class="task-icon">
        <div class="title-container">
          <h3>每日任务</h3>
          <p>当前进度</p>
        </div>
      </div>
      
      <div class="header-right">
        <div 
          class="status-indicator"
          :class="{ completed: isAllCompleted }"
          @click="showTaskDetails = true"
        >
          <div class="status-dot" :class="{ completed: isAllCompleted }"></div>
          <span>任务详情</span>
        </div>
        
        <button class="settings-button" @click="showSettings = true">
          <n-icon><Settings /></n-icon>
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-container">
      <n-progress
        type="line"
        :percentage="progressPercentage"
        :height="8"
        :border-radius="4"
        :color="progressColor"
        rail-color="#f3f4f6"
      />
    </div>

    <!-- 提示信息 -->
    <div class="info-container">
      右上角小齿轮有惊喜
    </div>

    <!-- 一键执行按钮 -->
    <button 
      class="execute-button"
      :disabled="isExecuting"
      @click="executeAllTasks"
    >
      <span v-if="isExecuting" class="loading-text">
        <svg class="loading-icon" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z"/>
        </svg>
        执行中...
      </span>
      <span v-else>一键补差</span>
    </button>

    <!-- 任务设置模态框 -->
    <n-modal
      v-model:show="showSettings"
      preset="card"
      title="任务设置"
      style="width: 400px"
    >
      <template #header>
        <div class="modal-header">
          <n-icon><Settings /></n-icon>
          <span>任务设置</span>
        </div>
      </template>
      
      <div class="settings-content">
        <div class="settings-grid">
          <!-- 竞技场设置 -->
          <div class="setting-item">
            <label class="setting-label">竞技场阵容</label>
            <n-select
              v-model:value="taskSettings.arenaFormation"
              :options="formationOptions"
              size="small"
              @update:value="saveSettings"
            />
          </div>
          
          <!-- BOSS设置 -->
          <div class="setting-item">
            <label class="setting-label">BOSS阵容</label>
            <n-select
              v-model:value="taskSettings.bossFormation"
              :options="formationOptions"
              size="small"
              @update:value="saveSettings"
            />
          </div>
          
          <!-- BOSS次数 -->
          <div class="setting-item">
            <label class="setting-label">BOSS次数</label>
            <n-select
              v-model:value="taskSettings.bossTimes"
              :options="bossTimesOptions"
              size="small"
              @update:value="saveSettings"
            />
          </div>
          
          <!-- 功能开关 -->
          <div class="setting-switches">
            <div class="switch-row">
              <span class="switch-label">领罐子</span>
              <n-switch
                v-model:value="taskSettings.claimBottle"
                @update:value="saveSettings"
              />
            </div>
            
            <div class="switch-row">
              <span class="switch-label">领挂机</span>
              <n-switch
                v-model:value="taskSettings.claimHangUp"
                @update:value="saveSettings"
              />
            </div>
            
            <div class="switch-row">
              <span class="switch-label">竞技场</span>
              <n-switch
                v-model:value="taskSettings.arenaEnable"
                @update:value="saveSettings"
              />
            </div>
            
            <div class="switch-row">
              <span class="switch-label">开宝箱</span>
              <n-switch
                v-model:value="taskSettings.openBox"
                @update:value="saveSettings"
              />
            </div>
            
            <div class="switch-row">
              <span class="switch-label">领取邮件奖励</span>
              <n-switch
                v-model:value="taskSettings.claimEmail"
                @update:value="saveSettings"
              />
            </div>
            
            <div class="switch-row">
              <span class="switch-label">付费招募</span>
              <n-switch
                v-model:value="taskSettings.payRecruit"
                @update:value="saveSettings"
              />
            </div>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- 任务详情模态框 -->
    <n-modal
      v-model:show="showTaskDetails"
      preset="card"
      title="每日任务详情"
      style="width: 400px"
    >
      <template #header>
        <div class="modal-header">
          <n-icon><Calendar /></n-icon>
          <span>每日任务详情</span>
        </div>
      </template>
      
      <div class="task-list">
        <div 
          v-for="task in dailyTasks"
          :key="task.id"
          class="task-item"
        >
          <div class="task-item-left">
            <n-icon 
              class="task-status-icon"
              :class="{ completed: task.completed }"
            >
              <CheckmarkCircle v-if="task.completed" />
              <EllipseOutline v-else />
            </n-icon>
            <span class="task-name">{{ task.name }}</span>
          </div>
          <n-tag
            :type="task.completed ? 'success' : 'default'"
            size="small"
          >
            {{ task.completed ? '已完成' : '未完成' }}
          </n-tag>
        </div>
      </div>
    </n-modal>

    <!-- 执行日志模态框 -->
    <n-modal
      v-model:show="showLog"
      preset="card"
      title="任务执行日志"
      style="width: 500px"
    >
      <template #header>
        <div class="modal-header">
          <n-icon><DocumentText /></n-icon>
          <span>任务执行日志</span>
        </div>
      </template>
      
      <div class="log-container" ref="logContainer">
        <div 
          v-for="log in executionLogs"
          :key="log.id"
          class="log-item"
        >
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span 
            class="log-message"
            :class="{
              error: log.type === 'error',
              success: log.type === 'success'
            }"
          >
            {{ log.message }}
          </span>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useTokenStore } from '@/stores/tokenStore'
import { useMessage } from 'naive-ui'
import { 
  Settings, 
  Calendar,
  CheckmarkCircle,
  EllipseOutline,
  DocumentText
} from '@vicons/ionicons5'

const tokenStore = useTokenStore()
const message = useMessage()

// 响应式数据
const showSettings = ref(false)
const showTaskDetails = ref(false)
const showLog = ref(false)
const isExecuting = ref(false)
const logContainer = ref(null)
const executionLogs = ref([])

// 任务设置
const taskSettings = ref({
  arenaFormation: 1,
  bossFormation: 1,
  bossTimes: 4,
  claimBottle: true,
  payRecruit: true,
  openBox: true,
  arenaEnable: true,
  claimHangUp: true,
  claimEmail: true
})

// 每日任务列表
const dailyTasks = ref([
  { id: 1, name: '登录一次游戏', completed: false, loading: false },
  { id: 2, name: '分享一次游戏', completed: false, loading: false },
  { id: 3, name: '赠送好友3次金币', completed: false, loading: false },
  { id: 4, name: '进行2次招募', completed: false, loading: false },
  { id: 5, name: '领取5次挂机奖励', completed: false, loading: false },
  { id: 6, name: '进行3次点金', completed: false, loading: false },
  { id: 7, name: '开启3次宝箱', completed: false, loading: false },
  { id: 12, name: '黑市购买1次物品（请设置采购清单）', completed: false, loading: false },
  { id: 13, name: '进行1场竞技场战斗', completed: false, loading: false },
  { id: 14, name: '收获1个任意盐罐', completed: false, loading: false }
])

// 选项配置
const formationOptions = [
  { label: '阵容1', value: 1 },
  { label: '阵容2', value: 2 },
  { label: '阵容3', value: 3 },
  { label: '阵容4', value: 4 }
]

const bossTimesOptions = [
  { label: '0次', value: 0 },
  { label: '1次', value: 1 },
  { label: '2次', value: 2 },
  { label: '3次', value: 3 },
  { label: '4次', value: 4 }
]

// 计算属性
const roleInfo = computed(() => {
  return tokenStore.gameData?.roleInfo
})

const dailyTaskData = computed(() => {
  return roleInfo.value?.role?.dailyTask
})

const progressPercentage = computed(() => {
  const current = dailyTaskData.value?.dailyPoint || 0
  return current > 100 ? 100 : current
})

const isAllCompleted = computed(() => {
  return progressPercentage.value === 100
})

const progressColor = computed(() => {
  return progressPercentage.value === 100 ? '#10b981' : '#3b82f6'
})

// 更新任务完成状态
const updateTaskStatus = () => {
  if (!dailyTaskData.value?.complete) return
  
  const completed = dailyTaskData.value.complete
  dailyTasks.value.forEach(task => {
    const taskStatus = completed[task.id.toString()]
    task.completed = taskStatus === -1 // -1 表示已完成
  })
}

// 添加日志
const addLog = (message, type = 'info') => {
  const log = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    message,
    type
  }
  executionLogs.value.push(log)
  
  // 自动滚动到底部
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// 保存设置
const saveSettings = () => {
  // 这里可以保存到 localStorage 或发送到服务器
  localStorage.setItem('taskSettings', JSON.stringify(taskSettings.value))
}

// 格式化时间
const formatTime = (timeString) => {
  return timeString
}

// 执行所有任务
const executeAllTasks = async () => {
  if (!tokenStore.selectedToken || isExecuting.value) return
  
  isExecuting.value = true
  showLog.value = true
  executionLogs.value = []
  
  addLog('开始执行任务...')
  
  try {
    const tokenId = tokenStore.selectedToken.id
    
    // 获取角色信息
    addLog('获取角色信息...')
    await tokenStore.sendMessageWithPromise(tokenId, 'role_getroleinfo')
    addLog('获取角色信息成功', 'success')
    
    // 执行各种任务
    if (taskSettings.value.claimHangUp) {
      addLog('领取挂机奖励...')
      await tokenStore.sendMessageWithPromise(tokenId, 'system_claimhangupreward')
    }
    
    if (taskSettings.value.claimBottle) {
      addLog('领取盐罐奖励...')
      await tokenStore.sendMessageWithPromise(tokenId, 'bottlehelper_claim')
    }
    
    if (taskSettings.value.payRecruit) {
      addLog('进行招募...')
      await tokenStore.sendMessageWithPromise(tokenId, 'hero_recruit', {
        byClub: false,
        recruitNumber: 1,
        recruitType: 3
      })
    }
    
    if (taskSettings.value.openBox) {
      addLog('开启宝箱...')
      await tokenStore.sendMessageWithPromise(tokenId, 'item_openbox', {
        itemId: 2001,
        number: 3
      })
    }
    
    if (taskSettings.value.arenaEnable) {
      addLog('进行竞技场战斗...')
      await tokenStore.sendMessageWithPromise(tokenId, 'fight_startareaarena', {
        targetId: 530479307
      })
    }
    
    if (taskSettings.value.claimEmail) {
      addLog('领取邮件奖励...')
      await tokenStore.sendMessageWithPromise(tokenId, 'mail_claimallattachment', {
        category: 0
      })
    }
    
    // 最后再次获取角色信息更新状态
    addLog('更新角色信息...')
    await tokenStore.sendMessageWithPromise(tokenId, 'role_getroleinfo')
    
    addLog('任务执行完成！', 'success')
    message.success('任务处理完成')
    
  } catch (error) {
    addLog(`任务执行失败: ${error.message}`, 'error')
    message.error('任务执行失败')
  } finally {
    isExecuting.value = false
  }
}

// 监听角色信息变化
watch(dailyTaskData, () => {
  updateTaskStatus()
}, { deep: true, immediate: true })

// 初始化设置
const initSettings = () => {
  const saved = localStorage.getItem('taskSettings')
  if (saved) {
    try {
      taskSettings.value = { ...taskSettings.value, ...JSON.parse(saved) }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }
}

// 生命周期
onMounted(() => {
  initSettings()
  updateTaskStatus()
})
</script>

<style scoped lang="scss">
.daily-task-container {
  background: white;
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-left: 4px solid var(--primary-color);
  transition: all var(--transition-normal);

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
}

.task-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.task-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.title-container {
  h3 {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--spacing-xs) 0;
  }

  p {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: 0;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-full);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-secondary);
  }

  &.completed {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.settings-button {
  padding: var(--spacing-xs);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--border-radius-medium);
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-tertiary);
  }
}

.progress-container {
  margin-bottom: var(--spacing-md);
}

.info-container {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
  text-align: center;
}

.execute-button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-medium);
  background: var(--primary-color);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--primary-color-hover);
  }

  &:disabled {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.loading-icon {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// 模态框样式
.modal-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-content {
  padding: var(--spacing-md) 0;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.setting-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
}

.switch-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-light);

  &:last-child {
    border-bottom: none;
  }
}

.task-item-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.task-status-icon {
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);

  &.completed {
    color: var(--success-color);
  }
}

.task-name {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.log-container {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
}

.log-time {
  color: var(--text-tertiary);
  min-width: 80px;
  flex-shrink: 0;
}

.log-message {
  color: var(--text-secondary);

  &.error {
    color: var(--error-color);
  }

  &.success {
    color: var(--success-color);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .task-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .header-right {
    justify-content: center;
  }
}
</style>