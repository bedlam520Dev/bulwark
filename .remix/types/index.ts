export interface PerformanceData {
  timestamp: number
  fps: number
  frameTime: number
  updateTime?: number
  renderTime?: number
  memory?: {
    used: number
    total: number
    textureMemory?: number
  }
  rendering?: {
    drawCalls: number
    gameObjects: number
    physicsBodies: number
    activeTweens: number
  }
  isJank: boolean
}

export interface PerformanceStats {
  current: number
  average: number
  min: number
  max: number
}

export interface BuildState {
  status: 'ready' | 'building' | 'success' | 'error' | 'warning'
  lastBuildTime: number
  fileSize: number
  output: string
  qrCodeUrl?: string
  isBuilding: boolean
}

export interface DevSettings {
  canvasGlow: boolean
  backgroundPattern: boolean
  fullSize: boolean
}

export interface RemixDevFlags {
  ready: boolean
  gameOver: boolean
  playAgain: boolean
  toggleMute: boolean
}

export interface DashboardState {
  performance: {
    data: PerformanceData[]
    stats: PerformanceStats
    isMonitoring: boolean
    tier: 'plugin' | 'iframe'
  }
  
  build: BuildState
  
  settings: DevSettings & {
    showPerformancePanel: boolean
  }
  
  ui: {
    isMiniMode: boolean
    showBuildPanel: boolean
    showStatusPanel: boolean
    showSettingsPanel: boolean
    showPerformancePanel: boolean
    showQrPanel: boolean
    showGameStatePanel: boolean
  }
  
  sdk: {
    flags: RemixDevFlags
    events: SDKEvent[]
    isMuted: boolean
  }
  
  game: {
    frameSize: { width: number; height: number }
    isGameOver: boolean
    score: number
  }
}

export interface SDKEvent {
  type: string
  data?: any
  timestamp: number
}

