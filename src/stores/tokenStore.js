import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bonProtocol, GameMessages, g_utils } from '../utils/bonProtocol.js'
import { XyzwWebSocketClient } from '../utils/xyzwWebSocket.js'

/**
 * 重构后的Token管理存储
 * 以名称-token列表形式管理多个游戏角色
 */
export const useTokenStore = defineStore('tokens', () => {
  // 状态
  const gameTokens = ref(JSON.parse(localStorage.getItem('gameTokens') || '[]'))
  const selectedTokenId = ref(localStorage.getItem('selectedTokenId') || null)
  const wsConnections = ref({}) // WebSocket连接状态

  // 游戏数据存储
  const gameData = ref({
    roleInfo: null,
    legionInfo: null,
    presetTeam: null,
    lastUpdated: null
  })

  // 计算属性
  const hasTokens = computed(() => gameTokens.value.length > 0)
  const selectedToken = computed(() =>
    gameTokens.value.find(token => token.id === selectedTokenId.value)
  )

  // Token管理
  const addToken = (tokenData) => {
    const newToken = {
      id: 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: tokenData.name,
      token: tokenData.token, // 保存原始Base64 token
      wsUrl: tokenData.wsUrl || null, // 可选的自定义WebSocket URL
      server: tokenData.server || '',
      level: tokenData.level || 1,
      profession: tokenData.profession || '',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      isActive: true
    }

    gameTokens.value.push(newToken)
    saveTokensToStorage()

    return newToken
  }

  const updateToken = (tokenId, updates) => {
    const index = gameTokens.value.findIndex(token => token.id === tokenId)
    if (index !== -1) {
      gameTokens.value[index] = {
        ...gameTokens.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      saveTokensToStorage()
      return true
    }
    return false
  }

  const removeToken = (tokenId) => {
    gameTokens.value = gameTokens.value.filter(token => token.id !== tokenId)
    saveTokensToStorage()

    // 关闭对应的WebSocket连接
    if (wsConnections.value[tokenId]) {
      closeWebSocketConnection(tokenId)
    }

    // 如果删除的是当前选中token，清除选中状态
    if (selectedTokenId.value === tokenId) {
      selectedTokenId.value = null
      localStorage.removeItem('selectedTokenId')
    }

    return true
  }

  const selectToken = (tokenId) => {
    const token = gameTokens.value.find(t => t.id === tokenId)
    if (token) {
      selectedTokenId.value = tokenId
      localStorage.setItem('selectedTokenId', tokenId)

      // 更新最后使用时间
      updateToken(tokenId, { lastUsed: new Date().toISOString() })

      // 自动建立WebSocket连接
      createWebSocketConnection(tokenId, token.token, token.wsUrl)

      return token
    }
    return null
  }

  // 辅助函数：分析数据结构
  const analyzeDataStructure = (obj, depth = 0, maxDepth = 3) => {
    if (depth > maxDepth || !obj || typeof obj !== 'object') {
      return typeof obj
    }
    
    const structure = {}
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        structure[key] = `Array[${value.length}]${value.length > 0 ? `: ${analyzeDataStructure(value[0], depth + 1, maxDepth)}` : ''}`
      } else if (typeof value === 'object' && value !== null) {
        structure[key] = analyzeDataStructure(value, depth + 1, maxDepth)
      } else {
        structure[key] = typeof value
      }
    }
    return structure
  }

  // 辅助函数：尝试解析队伍数据
  const tryParseTeamData = (data, cmd) => {
    console.log(`👥 尝试解析队伍数据 [${cmd}]:`, data)
    
    // 查找队伍相关字段
    const teamFields = []
    const scanForTeamData = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key
        
        if (key.toLowerCase().includes('team') || 
            key.toLowerCase().includes('preset') ||
            key.toLowerCase().includes('formation') ||
            key.toLowerCase().includes('lineup')) {
          teamFields.push({
            path: currentPath,
            key: key,
            value: value,
            type: typeof value,
            isArray: Array.isArray(value)
          })
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          scanForTeamData(value, currentPath)
        }
      }
    }
    
    scanForTeamData(data)
    
    if (teamFields.length > 0) {
      console.log(`👥 找到 ${teamFields.length} 个队伍相关字段:`, teamFields)
      
      // 尝试更新游戏数据
      teamFields.forEach(field => {
        if (field.key === 'presetTeamInfo' || field.path.includes('presetTeamInfo')) {
          console.log(`👥 发现预设队伍信息，准备更新:`, field.value)
          if (!gameData.value.presetTeam) {
            gameData.value.presetTeam = {}
          }
          gameData.value.presetTeam.presetTeamInfo = field.value
          gameData.value.lastUpdated = new Date().toISOString()
        }
      })
    } else {
      console.log(`👥 未找到明显的队伍字段，完整数据结构:`, analyzeDataStructure(data))
    }
  }

  // 游戏消息处理
  const handleGameMessage = (tokenId, message) => {
    try {
      if (!message || message.error) {
        console.warn(`⚠️ 消息处理跳过 [${tokenId}]:`, message?.error || '无效消息')
        return
      }

      const cmd = message.cmd?.toLowerCase()
      // 优先使用rawData（ProtoMsg自动解码），然后decodedBody（手动解码），最后body（原始数据）
      const body = message.rawData !== undefined ? message.rawData :
                   message.decodedBody !== undefined ? message.decodedBody :
                   message.body

      console.log(`📋 处理消息 [${tokenId}] ${cmd}:`, {
        hasRawData: message.rawData !== undefined,
        hasDecodedBody: message.decodedBody !== undefined,
        hasBody: message.body !== undefined,
        bodyType: body ? typeof body : 'undefined',
        bodyContent: body,
        originalCmd: message.cmd,
        fullMessage: message
      })
      
      // 记录所有消息的原始命令名
      console.log(`📨 收到消息 [${tokenId}] 原始cmd: "${message.cmd}", 处理cmd: "${cmd}"`)

      // 特别记录所有包含tower的消息
      if (cmd && cmd.includes('tower')) {
        console.log(`🗼 发现塔相关消息 [${tokenId}] ${cmd}:`, message)
      }

      // 处理角色信息 - 支持多种可能的响应命令
      if (cmd === 'role_getroleinfo' || cmd === 'role_getroleinforesp' || cmd.includes('role') && cmd.includes('info')) {
        console.log(`📊 匹配到角色信息命令: ${cmd}`)
          
        if (body) {
          gameData.value.roleInfo = body
          gameData.value.lastUpdated = new Date().toISOString()
          console.log('📊 角色信息已更新:', body)
          console.log('📊 角色信息类型:', typeof body)
          console.log('📊 角色信息内容概览:', Object.keys(body || {}))

          // 特别检查塔信息
          if (body.role?.tower) {
            console.log('🗼 在角色信息中找到塔信息:', body.role.tower)
          } else if (body.tower) {
            console.log('🗼 在响应根级别找到塔信息:', body.tower)
          } else {
            console.log('🗼 未找到塔信息在角色数据中')
            console.log('📊 角色数据结构:', body.role ? Object.keys(body.role) : '没有role对象')
          }
        } else {
          console.log('📊 角色信息响应body为空')
        }
      }

      // 处理军团信息
      else if (cmd === 'legion_getinfo') {
        if (body) {
          gameData.value.legionInfo = body
          console.log('🏛️ 军团信息已更新:', body)
        }
      }

      // 处理队伍信息 - 支持多种队伍相关响应
      else if (cmd === 'presetteam_getteam' || cmd === 'presetteam_getteamresp' || 
               cmd === 'presetteam_setteam' || cmd === 'presetteam_setteamresp' ||
               cmd === 'presetteam_saveteam' || cmd === 'presetteam_saveteamresp' ||
               cmd === 'role_gettargetteam' || cmd === 'role_gettargetteamresp' ||
               (cmd && cmd.includes('presetteam')) || (cmd && cmd.includes('team'))) {
        console.log(`👥 匹配到队伍信息命令: ${cmd}`)
        
        if (body) {
          // 更新队伍数据
          if (!gameData.value.presetTeam) {
            gameData.value.presetTeam = {}
          }
          
          // 根据不同的响应类型处理数据
          if (cmd.includes('getteam')) {
            // 获取队伍信息响应
            gameData.value.presetTeam = { ...gameData.value.presetTeam, ...body }
          } else if (cmd.includes('setteam') || cmd.includes('saveteam')) {
            // 设置/保存队伍响应 - 可能只返回确认信息
            if (body.presetTeamInfo) {
              gameData.value.presetTeam.presetTeamInfo = body.presetTeamInfo
            }
            // 合并其他队伍相关数据
            Object.keys(body).forEach(key => {
              if (key.includes('team') || key.includes('Team')) {
                gameData.value.presetTeam[key] = body[key]
              }
            })
          } else {
            // 其他队伍相关响应
            gameData.value.presetTeam = { ...gameData.value.presetTeam, ...body }
          }
          
          gameData.value.lastUpdated = new Date().toISOString()
          console.log('👥 队伍信息已更新:', {
            cmd: cmd,
            updatedData: gameData.value.presetTeam,
            bodyKeys: Object.keys(body),
            bodyContent: body
          })
          
          // 详细日志队伍数据结构
          if (gameData.value.presetTeam.presetTeamInfo) {
            console.log('👥 队伍详细结构:', {
              teamCount: Object.keys(gameData.value.presetTeam.presetTeamInfo).length,
              teamIds: Object.keys(gameData.value.presetTeam.presetTeamInfo),
              useTeamId: gameData.value.presetTeam.presetTeamInfo.useTeamId,
              sampleTeam: gameData.value.presetTeam.presetTeamInfo[1] || gameData.value.presetTeam.presetTeamInfo[Object.keys(gameData.value.presetTeam.presetTeamInfo)[0]]
            })
          }
        } else {
          console.log('👥 队伍信息响应body为空')
        }
      }

      // 处理爬塔响应
      else if (cmd === 'fight_starttower' || cmd === 'fight_starttowerresp') {
        if (body) {
          console.log('🗼 爬塔响应:', body)
          // 爬塔后立即更新角色信息和塔信息
          setTimeout(() => {
            console.log('🗼 爬塔后自动更新数据')
            try {
              const connection = wsConnections.value[tokenId]
              if (connection && connection.status === 'connected' && connection.client) {
                // 获取最新角色信息
                console.log('🗼 正在请求角色信息...')
                connection.client.send('role_getroleinfo', {})
              } else {
                console.warn('🗼 WebSocket未连接，无法更新数据')
              }
            } catch (error) {
              console.warn('爬塔后更新数据失败:', error)
            }
          }, 1000)
        }
      }

      // 处理心跳响应
      else if (cmd === '_sys/ack') {
        console.log(`💗 心跳响应 [${tokenId}]`)
      }

      // 处理其他消息
      else {
        console.log(`📋 收到游戏消息 [${tokenId}] ${cmd}:`, body)
        
        // 特别关注队伍相关的未处理消息
        if (cmd && (cmd.includes('team') || cmd.includes('preset') || cmd.includes('formation'))) {
          console.log(`👥 未处理的队伍相关消息 [${tokenId}] ${cmd}:`, {
            originalMessage: message,
            parsedBody: body,
            messageKeys: Object.keys(message || {}),
            bodyStructure: body ? analyzeDataStructure(body) : null
          })
          
          // 尝试自动解析队伍数据
          if (body && typeof body === 'object') {
            tryParseTeamData(body, cmd)
          }
        }
        
        // 特别关注塔相关的未处理消息
        if (cmd && cmd.includes('tower')) {
          console.log(`🗼 未处理的塔相关消息 [${tokenId}] ${cmd}:`, {
            originalMessage: message,
            parsedBody: body,
            messageKeys: Object.keys(message || {})
          })
        }
      }

    } catch (error) {
      console.error('处理游戏消息失败:', error)
    }
  }

  // Base64解析功能
  const parseBase64Token = (base64String) => {
    try {
      // 移除可能的前缀和空格
      const cleanBase64 = base64String.replace(/^data:.*base64,/, '').trim()

      // 解码base64
      const decoded = atob(cleanBase64)

      // 尝试解析为JSON
      let tokenData
      try {
        tokenData = JSON.parse(decoded)
      } catch {
        // 如果不是JSON，当作纯token字符串处理
        tokenData = { token: decoded }
      }

      return {
        success: true,
        data: tokenData
      }
    } catch (error) {
      return {
        success: false,
        error: '解析失败：' + error.message
      }
    }
  }

  const importBase64Token = (name, base64String, additionalInfo = {}) => {
    const parseResult = parseBase64Token(base64String)

    if (!parseResult.success) {
      return parseResult
    }

    const tokenData = {
      name,
      token: parseResult.data.token || parseResult.data.gameToken || base64String,
      ...additionalInfo,
      ...parseResult.data // 解析出的数据覆盖手动输入
    }

    const newToken = addToken(tokenData)

    return {
      success: true,
      data: newToken,
      message: `Token "${name}" 导入成功`
    }
  }

  // WebSocket连接管理
  const createWebSocketConnection = (tokenId, base64Token, customWsUrl = null) => {
    if (wsConnections.value[tokenId]) {
      closeWebSocketConnection(tokenId)
    }

    try {
      // 解析Base64获取实际Token
      let actualToken = base64Token

      // 尝试解析Base64获取实际token
      try {
        const cleanBase64 = base64Token.replace(/^data:.*base64,/, '').trim()
        const decoded = atob(cleanBase64)

        // 尝试解析为JSON获取token字段
        try {
          const tokenData = JSON.parse(decoded)
          actualToken = tokenData.token || tokenData.gameToken || decoded
        } catch {
          // 如果不是JSON，直接使用解码后的字符串
          actualToken = decoded
        }
      } catch (error) {
        console.warn('Base64解析失败，使用原始token:', error.message)
        actualToken = base64Token
      }

      // 使用固定的WebSocket基础地址，将token带入占位符
      const baseWsUrl = 'wss://xxz-xyzw.hortorgames.com/agent?p=%s&e=x&lang=chinese'
      const wsUrl = customWsUrl || baseWsUrl.replace('%s', encodeURIComponent(actualToken))

      console.log(`🔗 创建WebSocket连接:`, wsUrl)
      console.log(`🎯 Token ID: ${tokenId}`)
      console.log(`🔑 使用Token: ${actualToken.substring(0, 20)}...`)

      // 检查g_utils结构
      console.log('🔍 g_utils结构检查:', {
        hasGetEnc: !!g_utils.getEnc,
        hasEncode: !!g_utils.encode,
        hasParse: !!g_utils.parse,
        hasBon: !!g_utils.bon,
        bonHasDecode: !!(g_utils.bon && g_utils.bon.decode)
      })

      // 创建新的WebSocket客户端
      const wsClient = new XyzwWebSocketClient({
        url: wsUrl,
        utils: g_utils,
        heartbeatMs: 5000  // 5秒心跳间隔
      })

      // 设置连接状态
      wsConnections.value[tokenId] = {
        client: wsClient,
        status: 'connecting',
        tokenId,
        wsUrl,
        actualToken,
        connectedAt: null,
        lastMessage: null,
        lastError: null
      }

      // 设置事件监听
      wsClient.onConnect = () => {
        console.log(`✅ WebSocket连接已建立: ${tokenId}`)
        if (wsConnections.value[tokenId]) {
          wsConnections.value[tokenId].status = 'connected'
          wsConnections.value[tokenId].connectedAt = new Date().toISOString()
        }
      }

      wsClient.onDisconnect = (event) => {
        console.log(`🔌 WebSocket连接已断开: ${tokenId}`, event)
        if (wsConnections.value[tokenId]) {
          wsConnections.value[tokenId].status = 'disconnected'
        }
      }

      wsClient.onError = (error) => {
        console.error(`❌ WebSocket错误 [${tokenId}]:`, error)
        if (wsConnections.value[tokenId]) {
          wsConnections.value[tokenId].status = 'error'
          wsConnections.value[tokenId].lastError = {
            timestamp: new Date().toISOString(),
            error: error.toString(),
            url: wsUrl
          }
        }
      }

      // 设置消息监听
      wsClient.setMessageListener((message) => {
        console.log(`📨 收到消息 [${tokenId}]:`, message)

        // 更新连接状态中的最后接收消息
        if (wsConnections.value[tokenId]) {
          wsConnections.value[tokenId].lastMessage = {
            timestamp: new Date().toISOString(),
            data: message
          }
        }

        // 处理游戏消息
        handleGameMessage(tokenId, message)
      })

      // 开启调试模式
      wsClient.setShowMsg(true)

      // 初始化连接
      wsClient.init()

      return wsClient
    } catch (error) {
      console.error(`创建WebSocket连接失败 [${tokenId}]:`, error)
      return null
    }
  }

  const closeWebSocketConnection = (tokenId) => {
    const connection = wsConnections.value[tokenId]
    if (connection && connection.client) {
      connection.client.disconnect()
      delete wsConnections.value[tokenId]
    }
  }

  const getWebSocketStatus = (tokenId) => {
    return wsConnections.value[tokenId]?.status || 'disconnected'
  }

  // 获取WebSocket客户端
  const getWebSocketClient = (tokenId) => {
    return wsConnections.value[tokenId]?.client || null
  }


  // 发送消息到WebSocket
  const sendMessage = (tokenId, cmd, params = {}, options = {}) => {
    const connection = wsConnections.value[tokenId]
    if (!connection || connection.status !== 'connected') {
      console.error(`❌ WebSocket未连接，无法发送消息 [${tokenId}]`)
      return false
    }

    try {
      const client = connection.client
      if (!client) {
        console.error(`❌ WebSocket客户端不存在 [${tokenId}]`)
        return false
      }

      client.send(cmd, params, options)
      console.log(`📤 发送消息 [${tokenId}]: ${cmd}`, params)

      return true
    } catch (error) {
      console.error(`❌ 发送消息失败 [${tokenId}]:`, error)
      return false
    }
  }

  // Promise版发送消息
  const sendMessageWithPromise = async (tokenId, cmd, params = {}, timeout = 5000) => {
    const connection = wsConnections.value[tokenId]
    if (!connection || connection.status !== 'connected') {
      throw new Error(`WebSocket未连接 [${tokenId}]`)
    }

    const client = connection.client
    if (!client) {
      throw new Error(`WebSocket客户端不存在 [${tokenId}]`)
    }

    return await client.sendWithPromise(cmd, params, timeout)
  }

  // 发送心跳消息
  const sendHeartbeat = (tokenId) => {
    return sendMessage(tokenId, 'heart_beat')
  }

  // 发送获取角色信息请求
  const sendGetRoleInfo = (tokenId, params = {}) => {
    return sendMessageWithPromise(tokenId, 'role_getroleinfo', params)
  }

  // 发送获取数据版本请求
  const sendGetDataBundleVersion = (tokenId, params = {}) => {
    return sendMessageWithPromise(tokenId, 'system_getdatabundlever', params)
  }

  // 发送签到请求
  const sendSignIn = (tokenId) => {
    return sendMessageWithPromise(tokenId, 'system_signinreward')
  }

  // 发送领取日常任务奖励
  const sendClaimDailyReward = (tokenId, rewardId = 0) => {
    return sendMessageWithPromise(tokenId, 'task_claimdailyreward', { rewardId })
  }

  // 发送获取队伍信息
  const sendGetTeamInfo = (tokenId, params = {}) => {
    return sendMessageWithPromise(tokenId, 'presetteam_getteam', params)
  }

  // 发送自定义游戏消息
  const sendGameMessage = (tokenId, cmd, params = {}, options = {}) => {
    if (options.usePromise) {
      return sendMessageWithPromise(tokenId, cmd, params, options.timeout)
    } else {
      return sendMessage(tokenId, cmd, params, options)
    }
  }

  // 获取当前塔层数
  const getCurrentTowerLevel = () => {
    try {
      // 从游戏数据中获取塔信息
      const roleInfo = gameData.value.roleInfo
      if (!roleInfo || !roleInfo.role) {
        console.warn('⚠️ 角色信息不存在')
        return null
      }

      const tower = roleInfo.role.tower
      if (!tower) {
        console.warn('⚠️ 塔信息不存在')
        return null
      }

      // 可能的塔层数字段（根据实际数据结构调整）
      const level = tower.level || tower.currentLevel || tower.floor || tower.stage

      console.log('🗼 当前塔层数:', level, '塔信息:', tower)
      return level
    } catch (error) {
      console.error('❌ 获取塔层数失败:', error)
      return null
    }
  }

  // 获取详细塔信息
  const getTowerInfo = () => {
    try {
      const roleInfo = gameData.value.roleInfo
      if (!roleInfo || !roleInfo.role) {
        return null
      }

      return roleInfo.role.tower || null
    } catch (error) {
      console.error('❌ 获取塔信息失败:', error)
      return null
    }
  }

  // 工具方法
  const exportTokens = () => {
    return {
      tokens: gameTokens.value,
      exportedAt: new Date().toISOString(),
      version: '2.0'
    }
  }

  const importTokens = (data) => {
    try {
      if (data.tokens && Array.isArray(data.tokens)) {
        gameTokens.value = data.tokens
        saveTokensToStorage()
        return { success: true, message: `成功导入 ${data.tokens.length} 个Token` }
      } else {
        return { success: false, message: '导入数据格式错误' }
      }
    } catch (error) {
      return { success: false, message: '导入失败：' + error.message }
    }
  }

  const clearAllTokens = () => {
    // 关闭所有WebSocket连接
    Object.keys(wsConnections.value).forEach(tokenId => {
      closeWebSocketConnection(tokenId)
    })

    gameTokens.value = []
    selectedTokenId.value = null
    localStorage.removeItem('gameTokens')
    localStorage.removeItem('selectedTokenId')
  }

  const cleanExpiredTokens = () => {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const cleanedTokens = gameTokens.value.filter(token => {
      const lastUsed = new Date(token.lastUsed || token.createdAt)
      return lastUsed > oneDayAgo
    })

    const cleanedCount = gameTokens.value.length - cleanedTokens.length
    gameTokens.value = cleanedTokens
    saveTokensToStorage()

    return cleanedCount
  }

  const saveTokensToStorage = () => {
    localStorage.setItem('gameTokens', JSON.stringify(gameTokens.value))
  }

  // 初始化
  const initTokenStore = () => {
    // 恢复数据
    const savedTokens = localStorage.getItem('gameTokens')
    const savedSelectedId = localStorage.getItem('selectedTokenId')

    if (savedTokens) {
      try {
        gameTokens.value = JSON.parse(savedTokens)
      } catch (error) {
        console.error('解析Token数据失败:', error)
        gameTokens.value = []
      }
    }

    if (savedSelectedId) {
      selectedTokenId.value = savedSelectedId
    }

    // 清理过期token
    cleanExpiredTokens()
  }

  return {
    // 状态
    gameTokens,
    selectedTokenId,
    wsConnections,
    gameData,

    // 计算属性
    hasTokens,
    selectedToken,

    // Token管理方法
    addToken,
    updateToken,
    removeToken,
    selectToken,

    // Base64解析方法
    parseBase64Token,
    importBase64Token,

    // WebSocket方法
    createWebSocketConnection,
    closeWebSocketConnection,
    getWebSocketStatus,
    getWebSocketClient,
    sendMessage,
    sendMessageWithPromise,
    sendHeartbeat,
    sendGetRoleInfo,
    sendGetDataBundleVersion,
    sendSignIn,
    sendClaimDailyReward,
    sendGetTeamInfo,
    sendGameMessage,

    // 工具方法
    exportTokens,
    importTokens,
    clearAllTokens,
    cleanExpiredTokens,
    initTokenStore,

    // 塔信息方法
    getCurrentTowerLevel,
    getTowerInfo
  }
})
