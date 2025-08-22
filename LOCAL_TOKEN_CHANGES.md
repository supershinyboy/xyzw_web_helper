# 本地Token存储重构说明

本次重构完全移除了所有API接口请求，改为使用本地存储管理用户认证和游戏角色token。

## 主要变更

### 1. 新增文件

#### `/src/stores/localTokenManager.js`
- 完整的本地token管理系统
- 支持用户认证token和游戏角色token管理
- 内置WebSocket连接管理
- 支持token导入/导出、过期清理等功能

#### `/src/components/TokenManager.vue`
- Token管理界面组件
- 可视化显示所有token状态
- 支持WebSocket连接控制
- 提供批量操作功能

### 2. 修改的文件

#### `/src/stores/auth.js`
- **移除**: 所有`api.auth.*`调用
- **新增**: 本地认证逻辑，模拟用户登录
- **集成**: localTokenStore进行token管理

#### `/src/stores/gameRoles.js`
- **移除**: 所有`api.gameRoles.*`调用
- **新增**: 本地角色管理，自动生成游戏token
- **集成**: 角色选择时自动建立WebSocket连接

#### `/src/views/DailyTasks.vue`
- **移除**: `api.dailyTasks.*`调用
- **新增**: 本地模拟任务数据生成
- **集成**: 通过WebSocket执行任务（模拟）

#### `/src/views/Profile.vue`
- **新增**: TokenManager组件，提供token管理界面

## 核心功能

### 用户认证
```javascript
// 本地认证，无需API调用
const result = await authStore.login({ username, password })
```

### 游戏角色管理
```javascript
// 添加角色时自动生成游戏token
const result = await gameRolesStore.addGameRole(roleData)
// 自动生成: roleId, gameToken, wsUrl
```

### WebSocket连接
```javascript
// 选择角色时自动建立WebSocket连接
gameRolesStore.selectRole(role)
// 使用本地存储的token建立连接

// 手动控制连接
localTokenStore.createWebSocketConnection(roleId, token, wsUrl)
localTokenStore.closeWebSocketConnection(roleId)
```

### Token管理
```javascript
// 添加游戏token
localTokenStore.addGameToken(roleId, tokenData)

// 获取token
const tokenData = localTokenStore.getGameToken(roleId)

// 导出所有token
const backup = localTokenStore.exportTokens()

// 导入token
localTokenStore.importTokens(backupData)
```

## 数据结构

### 游戏Token数据结构
```javascript
{
  token: "game_token_xxx",      // 游戏token
  roleId: "role_xxx",           // 角色ID
  roleName: "角色名称",          // 角色名称
  server: "服务器名",            // 服务器
  wsUrl: "wss://game.xxx/ws",   // WebSocket URL
  createdAt: "2024-01-01T00:00:00Z",
  lastUsed: "2024-01-01T00:00:00Z",
  isActive: true
}
```

### WebSocket连接状态
```javascript
{
  connection: WebSocket,        // WebSocket连接对象
  status: "connected",          // 连接状态
  roleId: "role_xxx",          // 关联角色ID
  connectedAt: "2024-01-01T00:00:00Z"
}
```

## 使用说明

### 1. 登录
- 用户名/密码任意输入即可本地认证
- 自动生成用户token并保存

### 2. 添加游戏角色
- 填写角色信息后自动生成：
  - 角色ID
  - 游戏token
  - WebSocket连接URL

### 3. 管理Token
- 访问"个人设置"页面查看Token管理器
- 可以查看、编辑、删除、导出/导入token
- 可以手动控制WebSocket连接

### 4. 执行任务
- 选择角色后自动建立WebSocket连接
- 执行任务通过WebSocket发送指令（模拟）
- 所有操作记录保存在本地

## 优势

1. **完全离线**: 无需任何服务器接口
2. **数据安全**: 所有数据存储在本地
3. **功能完整**: 保留原有所有功能
4. **易于扩展**: 模块化设计，便于添加新功能
5. **WebSocket支持**: 内置完整的WebSocket连接管理

## 注意事项

1. 所有数据存储在浏览器localStorage中
2. 清除浏览器数据会丢失所有token
3. 建议定期使用导出功能备份token数据
4. WebSocket连接使用模拟URL，需要根据实际情况修改