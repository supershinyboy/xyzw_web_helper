<template>
  <div class="game-status-container">
    <!-- 队伍状态 -->
    <TeamStatus />
    
    <!-- 每日任务状态 -->
    <DailyTaskStatus />
    
    <!-- 咸将塔状态 -->
    <TowerStatus />
    
    <!-- 其他游戏状态卡片 -->
    <!-- 盐罐机器人状态 -->
    <div class="status-card bottle-helper">
      <div class="card-header">
        <img src="/icons/173746572831736.png" alt="盐罐图标" class="status-icon">
        <div class="status-info">
          <h3>盐罐机器人</h3>
          <p>剩余时间</p>
        </div>
        <div class="status-badge" :class="{ active: bottleHelper.isRunning }">
          <div class="status-dot"></div>
          <span>{{ bottleHelper.isRunning ? '运行中' : '已停止' }}</span>
        </div>
      </div>
      <div class="card-content">
        <div class="time-display">
          {{ formatTime(bottleHelper.remainingTime) }}
        </div>
        <button 
          class="action-button"
          :class="{ active: bottleHelper.isRunning }"
          @click="handleBottleHelper"
        >
          {{ bottleHelper.isRunning ? '重启服务' : '启动服务' }}
        </button>
      </div>
    </div>

    <!-- 挂机状态 -->
    <div class="status-card hang-up">
      <div class="card-header">
        <img src="/icons/174061875626614.png" alt="挂机图标" class="status-icon">
        <div class="status-info">
          <h3>挂机时间</h3>
          <p>已挂机：{{ formatTime(hangUp.elapsedTime) }}</p>
        </div>
        <div class="status-badge" :class="{ active: hangUp.isActive }">
          <div class="status-dot"></div>
          <span>{{ hangUp.isActive ? '挂机中' : '已完成' }}</span>
        </div>
      </div>
      <div class="card-content">
        <div class="time-display">
          {{ formatTime(hangUp.remainingTime) }}
        </div>
        <div class="action-row">
          <button class="action-button secondary" @click="extendHangUp">
            加钟
          </button>
          <button class="action-button primary" @click="claimHangUpReward">
            领取奖励
          </button>
        </div>
      </div>
    </div>

    <!-- 俱乐部排位 -->
    <div class="status-card legion-match">
      <div class="card-header">
        <img src="/icons/1733492491706152.png" alt="俱乐部图标" class="status-icon">
        <div class="status-info">
          <h3>俱乐部排位</h3>
          <p>赛事状态</p>
        </div>
        <div class="status-badge" :class="{ active: legionMatch.isRegistered }">
          <div class="status-dot"></div>
          <span>{{ legionMatch.isRegistered ? '已报名' : '未报名' }}</span>
        </div>
      </div>
      <div class="card-content">
        <p class="description">
          每逢周三周四周五有比赛<br>
          立即报名参与精彩对决！
        </p>
        <button 
          class="action-button"
          :disabled="legionMatch.isRegistered"
          @click="registerLegionMatch"
        >
          {{ legionMatch.isRegistered ? '已报名' : '立即报名' }}
        </button>
      </div>
    </div>

    <!-- 俱乐部签到 -->
    <div class="status-card legion-signin">
      <div class="card-header">
        <img src="/icons/1733492491706148.png" alt="签到图标" class="status-icon">
        <div class="status-info">
          <h3>俱乐部签到</h3>
          <p>每日签到状态</p>
        </div>
        <div class="status-badge" :class="{ active: legionSignin.isSignedIn }">
          <div class="status-dot"></div>
          <span>{{ legionSignin.isSignedIn ? '已签到' : '待签到' }}</span>
        </div>
      </div>
      <div class="card-content">
        <p class="club-name" v-if="legionSignin.clubName">
          当前俱乐部<br>
          <strong>{{ legionSignin.clubName }}</strong>
        </p>
        <p class="description" v-else>
          尚未加入任何俱乐部
        </p>
        <button 
          class="action-button"
          :disabled="legionSignin.isSignedIn"
          @click="signInLegion"
        >
          {{ legionSignin.isSignedIn ? '已签到' : '立即签到' }}
        </button>
      </div>
    </div>

    <!-- 咸鱼大冲关 -->
    <div class="status-card study">
      <div class="card-header">
        <img src="/icons/1736425783912140.png" alt="学习图标" class="status-icon">
        <div class="status-info">
          <h3>咸鱼大冲关</h3>
          <p>每日知识挑战</p>
        </div>
        <div class="status-badge weekly">
          <div class="status-dot"></div>
          <span>每周任务</span>
        </div>
      </div>
      <div class="card-content">
        <p class="description">
          没有什么可以阻挡我求知的欲望！
        </p>
        <button 
          class="action-button"
          :disabled="study.isAnswering"
          @click="startStudy"
        >
          <span v-if="study.isAnswering" class="loading-text">
            <svg class="loading-icon" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z"/>
            </svg>
            答题中...
          </span>
          <span v-else>一键答题</span>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTokenStore } from '@/stores/tokenStore'
import { useMessage } from 'naive-ui'
import TeamStatus from './TeamStatus.vue'
import DailyTaskStatus from './DailyTaskStatus.vue'
import TowerStatus from './TowerStatus.vue'

const tokenStore = useTokenStore()
const message = useMessage()

// 响应式数据
const bottleHelper = ref({
  isRunning: false,
  remainingTime: 0,
  stopTime: 0
})

const hangUp = ref({
  isActive: false,
  remainingTime: 0,
  elapsedTime: 0,
  lastTime: 0,
  hangUpTime: 0
})

const legionMatch = ref({
  isRegistered: false
})

const legionSignin = ref({
  isSignedIn: false,
  clubName: ''
})

const study = ref({
  isAnswering: false
})


// 计算属性
const roleInfo = computed(() => {
  return tokenStore.gameData?.roleInfo || null
})

// 格式化时间 - 确保显示到秒
const formatTime = (seconds) => {
  // 确保传入值为数字，并向下取整到秒
  const totalSeconds = Math.floor(Number(seconds) || 0)
  
  if (totalSeconds <= 0) return '00:00:00'
  
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 更新数据
const updateGameStatus = () => {
  if (!roleInfo.value) return

  const role = roleInfo.value.role

  // 更新盐罐机器人状态
  if (role.bottleHelpers) {
    const now = Date.now() / 1000
    bottleHelper.value.stopTime = role.bottleHelpers.helperStopTime
    bottleHelper.value.isRunning = role.bottleHelpers.helperStopTime > now
    // 确保剩余时间为整数秒
    bottleHelper.value.remainingTime = Math.max(0, Math.floor(role.bottleHelpers.helperStopTime - now))
    console.log('🤖 盐罐机器人状态更新:', {
      stopTime: role.bottleHelpers.helperStopTime,
      now: now,
      remainingTime: bottleHelper.value.remainingTime,
      isRunning: bottleHelper.value.isRunning
    })
  }

  // 更新挂机状态
  if (role.hangUp) {
    const now = Date.now() / 1000
    hangUp.value.lastTime = role.hangUp.lastTime
    hangUp.value.hangUpTime = role.hangUp.hangUpTime
    
    const elapsed = now - hangUp.value.lastTime
    if (elapsed <= hangUp.value.hangUpTime) {
      // 确保剩余时间为整数秒
      hangUp.value.remainingTime = Math.floor(hangUp.value.hangUpTime - elapsed)
      hangUp.value.isActive = true
    } else {
      hangUp.value.remainingTime = 0
      hangUp.value.isActive = false
    }
    // 确保已挂机时间为整数秒
    hangUp.value.elapsedTime = Math.floor(hangUp.value.hangUpTime - hangUp.value.remainingTime)
    
    console.log('⏰ 挂机状态更新:', {
      lastTime: hangUp.value.lastTime,
      hangUpTime: hangUp.value.hangUpTime,
      elapsed: elapsed,
      remainingTime: hangUp.value.remainingTime,
      elapsedTime: hangUp.value.elapsedTime,
      isActive: hangUp.value.isActive
    })
  }

  // 更新俱乐部排位状态
  if (role.statistics) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime() / 1000
    
    legionMatch.value.isRegistered = 
      Number(role.statistics['last:legion:match:sign:up:time']) > todayTimestamp
  }

  // 更新俱乐部签到状态
  if (role.statisticsTime) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime() / 1000
    
    legionSignin.value.isSignedIn = 
      role.statisticsTime['legion:sign:in'] > todayTimestamp
  }

}

// 定时器更新
let timer = null
const startTimer = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    // 更新盐罐机器人剩余时间
    if (bottleHelper.value.isRunning && bottleHelper.value.remainingTime > 0) {
      bottleHelper.value.remainingTime = Math.max(0, bottleHelper.value.remainingTime - 1)
      if (bottleHelper.value.remainingTime <= 0) {
        bottleHelper.value.isRunning = false
      }
    }
    
    // 更新挂机剩余时间
    if (hangUp.value.isActive && hangUp.value.remainingTime > 0) {
      hangUp.value.remainingTime = Math.max(0, hangUp.value.remainingTime - 1)
      hangUp.value.elapsedTime = hangUp.value.elapsedTime + 1
      if (hangUp.value.remainingTime <= 0) {
        hangUp.value.isActive = false
      }
    }
  }, 1000)
}

// 盐罐机器人操作
const handleBottleHelper = () => {
  if (!tokenStore.selectedToken) {
    message.warning('请先选择Token')
    return
  }

  const tokenId = tokenStore.selectedToken.id
  
  // 停止后重启
  tokenStore.sendMessage(tokenId, 'bottlehelper_stop')
  setTimeout(() => {
    tokenStore.sendMessage(tokenId, 'bottlehelper_start')
    tokenStore.sendMessage(tokenId, 'role_getroleinfo')
  }, 500)
  
  message.info(bottleHelper.value.isRunning ? '重启盐罐机器人' : '启动盐罐机器人')
}

// 挂机操作
const extendHangUp = () => {
  if (!tokenStore.selectedToken) return
  
  const tokenId = tokenStore.selectedToken.id
  
  // 发送4次分享回调请求来加钟
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      tokenStore.sendMessage(tokenId, 'system_mysharecallback', {
        isSkipShareCard: true,
        type: 2
      })
    }, i * 200)
  }
  
  message.info('正在加钟...')
}

const claimHangUpReward = () => {
  if (!tokenStore.selectedToken) return
  
  const tokenId = tokenStore.selectedToken.id
  
  // 领取挂机奖励
  tokenStore.sendMessage(tokenId, 'system_mysharecallback')
  tokenStore.sendMessage(tokenId, 'system_claimhangupreward')
  tokenStore.sendMessage(tokenId, 'system_mysharecallback', {
    isSkipShareCard: true,
    type: 2
  })
  tokenStore.sendMessage(tokenId, 'role_getroleinfo')
  
  message.info('领取挂机奖励')
}

// 俱乐部排位报名
const registerLegionMatch = () => {
  if (!tokenStore.selectedToken || legionMatch.value.isRegistered) return
  
  const tokenId = tokenStore.selectedToken.id
  tokenStore.sendMessage(tokenId, 'legionmatch_rolesignup')
  
  message.info('报名俱乐部排位')
}

// 俱乐部签到
const signInLegion = () => {
  if (!tokenStore.selectedToken || legionSignin.value.isSignedIn) return
  
  const tokenId = tokenStore.selectedToken.id
  tokenStore.sendMessage(tokenId, 'legion_signin')
  tokenStore.sendMessage(tokenId, 'role_getroleinfo')
  
  message.info('俱乐部签到')
}

// 学习答题
const startStudy = () => {
  if (!tokenStore.selectedToken || study.value.isAnswering) return
  
  study.value.isAnswering = true
  const tokenId = tokenStore.selectedToken.id
  tokenStore.sendMessage(tokenId, 'study_startgame')
  
  setTimeout(() => {
    study.value.isAnswering = false
  }, 3000)
  
  message.info('开始答题')
}


// 监听角色信息变化
watch(roleInfo, (newValue) => {
  if (newValue) {
    updateGameStatus()
  }
}, { deep: true, immediate: true })

// 生命周期
onMounted(() => {
  updateGameStatus()
  startTimer()
  
  // 获取俱乐部信息
  if (tokenStore.selectedToken) {
    const tokenId = tokenStore.selectedToken.id
    tokenStore.sendMessage(tokenId, 'legion_getinfo')
  }
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped lang="scss">
.game-status-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
}

.status-card {
  background: white;
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-normal);
  min-height: 200px;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.status-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.status-info {
  flex: 1;

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

.status-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: rgba(156, 163, 175, 0.1);
  color: var(--text-secondary);

  &.active {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
  }

  &.weekly {
    background: rgba(59, 130, 246, 0.1);
    color: var(--info-color);
  }

  &.energy {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.energy-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.card-content {
  .time-display {
    font-size: 1.5rem; /* text-2xl */
    font-weight: 700; /* font-bold */
    color: #111827; /* text-gray-900 */
    text-align: center;
    margin-bottom: var(--spacing-md);
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', monospace;
    letter-spacing: 0.1em;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease-in-out;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    }
  }

  .description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: var(--spacing-lg);
  }

  .club-name {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);

    strong {
      color: var(--text-primary);
      font-weight: var(--font-weight-medium);
    }
  }

  .tower-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);

    .label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .tower-level {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
    }
  }
}

.action-button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--primary-color);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-color-hover);
    transform: translateY(-1px);
  }

  &:disabled {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  &.secondary {
    background: var(--secondary-color);
    
    &:hover:not(:disabled) {
      background: var(--secondary-color-hover);
    }
  }

  &.active {
    background: var(--info-color);
    
    &:hover {
      background: var(--info-color-hover);
    }
  }
}

.action-row {
  display: flex;
  gap: var(--spacing-sm);

  .action-button {
    flex: 1;
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

// 响应式设计
@media (max-width: 768px) {
  .game-status-container {
    grid-template-columns: 1fr;
    padding: var(--spacing-md);
  }

  .status-card {
    padding: var(--spacing-md);
  }

  .card-header {
    flex-direction: column;
    text-align: center;
    gap: var(--spacing-sm);
  }
}
</style>