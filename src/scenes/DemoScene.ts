import GameSettings from "../config/GameSettings"

// Declare the FarcadeSDK type on window
declare global {
  interface Window {
    FarcadeSDK: any
  }
}

interface Ball {
  sprite: Phaser.GameObjects.Arc
  velocityX: number
  velocityY: number
  radius: number
}

export class DemoScene extends Phaser.Scene {
  private balls: Ball[] = []
  private clickCount: number = 0
  private clickText?: Phaser.GameObjects.Text
  private gameOver: boolean = false
  
  // Multiplayer support
  private isMultiplayer: boolean = false
  private players: Array<{id: string, name: string, imageUrl?: string}> = []
  private meId: string = '1'
  private otherPlayerClicks: number = 0
  private allClickCounts: {[key: string]: number} = {}

  constructor() {
    super({ key: "DemoScene" })
  }

  preload(): void {}

  create(): void {
    // Initialize SDK and determine mode
    this.initializeSDK()

    // Add instructional text
    const title = this.add.text(GameSettings.canvas.width / 2, GameSettings.canvas.height / 2 - 100, 'Remix SDK Demo', {
      fontSize: '64px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5).setDepth(100)

    const instruction = this.add.text(GameSettings.canvas.width / 2, GameSettings.canvas.height / 2 - 20, 'Click anywhere 3 times to trigger Game Over!', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center'
    }).setOrigin(0.5).setDepth(100)

    // Add click counter text (centered at top)
    this.clickText = this.add.text(GameSettings.canvas.width / 2, 50, 'Score: 0/3', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5).setDepth(100)

    // Add removal instructions at bottom
    const removeInstructions = this.add.text(
      GameSettings.canvas.width / 2,
      GameSettings.canvas.height - 60,
      'To remove this demo, ask your AI:\n"Remove the demo and create a minimal GameScene"',
      {
        fontSize: '24px',
        color: '#cccccc',
        fontFamily: 'Arial',
        align: 'center',
        wordWrap: { width: GameSettings.canvas.width - 40 }
      }
    ).setOrigin(0.5).setDepth(100)

    // Create bouncing balls
    this.createBalls(15)

    // Add global click listener
    this.input.on('pointerdown', () => {
      if (!this.gameOver) {
        this.handleClick()
      }
    })
  }

  private createBalls(count: number): void {
    for (let i = 0; i < count; i++) {
      const radius = Phaser.Math.Between(25, 60)
      const x = Phaser.Math.Between(radius, GameSettings.canvas.width - radius)
      const y = Phaser.Math.Between(radius, GameSettings.canvas.height - radius)
      
      // Remix green color
      const color = 0x33ff00
      const ball = this.add.circle(x, y, radius, color)
      ball.setStrokeStyle(2, 0x000000)
      ball.setInteractive()
      
      
      const ballData: Ball = {
        sprite: ball,
        velocityX: Phaser.Math.Between(-300, 300),
        velocityY: Phaser.Math.Between(-300, 300),
        radius: radius
      }
      
      this.balls.push(ballData)
    }
  }


  update(_time: number, deltaTime: number): void {
    const dt = deltaTime / 1000


    this.balls.forEach(ball => {
      // Update position
      ball.sprite.x += ball.velocityX * dt
      ball.sprite.y += ball.velocityY * dt

      // Bounce off edges
      if (ball.sprite.x - ball.radius <= 0 || ball.sprite.x + ball.radius >= GameSettings.canvas.width) {
        ball.velocityX *= -1
        ball.sprite.x = Phaser.Math.Clamp(ball.sprite.x, ball.radius, GameSettings.canvas.width - ball.radius)
      }
      
      if (ball.sprite.y - ball.radius <= 0 || ball.sprite.y + ball.radius >= GameSettings.canvas.height) {
        ball.velocityY *= -1
        ball.sprite.y = Phaser.Math.Clamp(ball.sprite.y, ball.radius, GameSettings.canvas.height - ball.radius)
      }
    })

    // Check ball-to-ball collisions
    this.checkBallCollisions()
  }

  private checkBallCollisions(): void {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const ball1 = this.balls[i]
        const ball2 = this.balls[j]
        
        const dx = ball2.sprite.x - ball1.sprite.x
        const dy = ball2.sprite.y - ball1.sprite.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const minDistance = ball1.radius + ball2.radius
        
        if (distance < minDistance) {
          // Collision detected - separate balls
          const overlap = minDistance - distance
          const separationX = (dx / distance) * (overlap / 2)
          const separationY = (dy / distance) * (overlap / 2)
          
          ball1.sprite.x -= separationX
          ball1.sprite.y -= separationY
          ball2.sprite.x += separationX
          ball2.sprite.y += separationY
          
          // Calculate collision response
          const angle = Math.atan2(dy, dx)
          const sin = Math.sin(angle)
          const cos = Math.cos(angle)
          
          // Rotate velocities to collision normal
          const vx1 = ball1.velocityX * cos + ball1.velocityY * sin
          const vy1 = ball1.velocityY * cos - ball1.velocityX * sin
          const vx2 = ball2.velocityX * cos + ball2.velocityY * sin
          const vy2 = ball2.velocityY * cos - ball2.velocityX * sin
          
          // Apply conservation of momentum (assuming equal mass)
          const newVx1 = vx2
          const newVx2 = vx1
          
          // Rotate velocities back
          ball1.velocityX = newVx1 * cos - vy1 * sin
          ball1.velocityY = vy1 * cos + newVx1 * sin
          ball2.velocityX = newVx2 * cos - vy2 * sin
          ball2.velocityY = vy2 * cos + newVx2 * sin
        }
      }
    }
  }

  private async initializeSDK(): Promise<void> {
    if (!window.FarcadeSDK) {
      return
    }

    // Determine multiplayer mode based on build configuration
    // In development, we can check package.json dynamically
    // In production, GAME_MULTIPLAYER_MODE will be replaced with true/false by Vite
    try {
      // @ts-ignore - This will be replaced at build time
      this.isMultiplayer = GAME_MULTIPLAYER_MODE
      console.log('DemoScene multiplayer mode (from build):', this.isMultiplayer)
    } catch {
      // Fallback: If not built with our Vite config (e.g., on Remix.gg),
      // try to detect based on available SDK methods
      if (window.FarcadeSDK.multiplayer && window.FarcadeSDK.multiplayer.actions) {
        this.isMultiplayer = true
        console.log('DemoScene multiplayer mode (detected multiplayer SDK):', this.isMultiplayer)
      } else {
        this.isMultiplayer = false
        console.log('DemoScene multiplayer mode (single-player fallback):', this.isMultiplayer)
      }
    }

    // Set up SDK event listeners - just like chess.js does, no defensive checks
    window.FarcadeSDK.on('play_again', () => {
      console.log(`[Player ${this.meId}] Play again triggered`)
      this.restartGame()
      // Send reset state to other player after restart
      if (this.isMultiplayer) {
        // Small delay to ensure state is reset before sending
        setTimeout(() => {
          this.sendGameState()
        }, 10)
      }
    })

    window.FarcadeSDK.on('toggle_mute', (data: { isMuted: boolean }) => {
      // Handle mute toggle if needed
      console.log('Toggle mute:', data.isMuted)
    })

    if (this.isMultiplayer) {
      // Multiplayer setup - Set up listeners BEFORE calling ready
      window.FarcadeSDK.on('game_info', ({ players, meId }: any) => {
        console.log('Received game_info:', { players, meId })
        this.players = players
        this.meId = meId
        console.log(`[Player ${this.meId}] Initialized with players:`, this.players)
      })

      window.FarcadeSDK.on('game_state_updated', (gameState: any) => {
        console.log(`[Player ${this.meId}] Received game_state_updated:`, gameState)
        
        // Handle it exactly like chess.js does
        if (!gameState) {
          this.setupNewGame()
        } else {
          this.handleGameStateUpdate(gameState)
        }
      })

      // Call multiplayer ready - no defensive checks, just like chess.js
      console.log('Calling multiplayer.actions.ready()')
      window.FarcadeSDK.multiplayer.actions.ready()
      
      // Send initial state after ready, like chess.js does in setupNewGame
      setTimeout(() => {
        this.sendGameState()
      }, 100)
    } else {
      // Single player - call ready
      console.log('Calling singlePlayer.actions.ready()')
      window.FarcadeSDK.singlePlayer.actions.ready()
    }
  }

  private sendGameState(): void {
    if (!this.isMultiplayer || !window.FarcadeSDK) return
    
    // Wait until we have player info before sending state
    if (!this.players || this.players.length === 0) {
      console.log(`[Player ${this.meId}] Cannot send state - no player info yet`)
      return
    }

    const otherPlayerId = this.players.find(p => p.id !== this.meId)?.id

    // Include both players' click counts - structure like chess.js
    const stateData = {
      players: this.players,
      clickCounts: {
        [this.meId]: this.clickCount,
        [otherPlayerId || '2']: this.otherPlayerClicks
      },
      gameOver: this.gameOver
    }
    
    console.log(`[Player ${this.meId}] Sending state:`, stateData)
    
    // Call updateGameState directly, no defensive checks - like chess.js
    window.FarcadeSDK.multiplayer.actions.updateGameState({
      data: stateData,
      alertUserIds: otherPlayerId ? [otherPlayerId] : []
    })
  }

  private setupNewGame(): void {
    console.log(`[Player ${this.meId}] Setting up new game`)
    this.restartGame()
    // Send initial state
    if (this.isMultiplayer) {
      this.sendGameState()
    }
  }

  private handleGameStateUpdate(gameState: any): void {
    // Handle the game state exactly like chess.js does
    if (!gameState) {
      this.setupNewGame()
      return
    }

    // Chess.js expects { id: string, data: { players, moves } }
    // We have { id: string, data: { players, clickCounts, gameOver } }
    const { id, data } = gameState
    
    if (!data) {
      console.log(`[Player ${this.meId}] No data in game state`)
      this.setupNewGame()
      return
    }

    console.log(`[Player ${this.meId}] Received state update:`, data)
    
    // Update game state from data
    if (data.players) {
      this.players = data.players
    }
    
    this.handleStateUpdate(data)
  }

  private handleStateUpdate(data: any): void {
    if (!data) {
      this.restartGame()
      return
    }

    // Update all click counts
    if (data.clickCounts) {
      this.allClickCounts = { ...data.clickCounts }
      
      // Update other player's count specifically
      if (this.players && this.players.length > 0) {
        const otherPlayerId = this.players.find(p => p.id !== this.meId)?.id
        if (otherPlayerId && data.clickCounts[otherPlayerId] !== undefined) {
          this.otherPlayerClicks = data.clickCounts[otherPlayerId]
          console.log(`[Player ${this.meId}] Other player clicks:`, this.otherPlayerClicks)
        }
      }
      
      // Also update our own count if it's different (in case of sync issues)
      if (data.clickCounts[this.meId] !== undefined && data.clickCounts[this.meId] !== this.clickCount) {
        // Only update if the other player has a higher count (they clicked more recently)
        if (data.clickCounts[this.meId] > this.clickCount) {
          this.clickCount = data.clickCounts[this.meId]
          if (this.clickText) {
            this.clickText.setText(`Score: ${this.clickCount}/3`)
          }
        }
      }
    }

    // Check game state changes
    if (data.gameOver === true && !this.gameOver) {
      console.log(`[Player ${this.meId}] Other player triggered game over`)
      // Store the scores before marking game over
      if (data.clickCounts) {
        // Update our knowledge of all click counts
        const otherPlayerId = this.players?.find(p => p.id !== this.meId)?.id
        if (otherPlayerId && data.clickCounts[otherPlayerId] !== undefined) {
          this.otherPlayerClicks = data.clickCounts[otherPlayerId]
        }
        // Also ensure our own count is up to date
        if (data.clickCounts[this.meId] !== undefined) {
          this.clickCount = data.clickCounts[this.meId]
        }
      }
      
      // Mark game over locally
      this.gameOver = true
      
      // Trigger game over in SDK for this player too (with the same scores)
      // This ensures both players see the game over screen
      if (window.FarcadeSDK) {
        if (this.isMultiplayer && this.players && this.players.length === 2) {
          // Build the complete click counts from the received data
          const scores = this.players.map(player => ({
            playerId: player.id,
            score: data.clickCounts?.[player.id] || 0
          }))
          
          console.log(`[Player ${this.meId}] Also triggering game over with scores:`, scores)
          window.FarcadeSDK.multiplayer.actions.gameOver({ scores })
        } else {
          // Fallback for single player mode
          window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.clickCount })
        }
      }
    }
  }

  private handleClick(): void {
    this.clickCount++
    if (this.clickText) {
      this.clickText.setText(`Score: ${this.clickCount}/3`)
    }
    
    // Check if this click triggers game over
    if (this.clickCount >= 3) {
      // Set game over state BEFORE sending state update
      this.gameOver = true
      
      // Send final state with gameOver = true
      if (this.isMultiplayer) {
        this.sendGameState()
      }
      
      // Small delay to ensure state is sent before triggering SDK game over
      setTimeout(() => {
        this.triggerGameOver()
      }, 50)
    } else {
      // Normal click - just send updated count
      if (this.isMultiplayer) {
        this.sendGameState()
      }
    }
  }

  private triggerGameOver(): void {
    // gameOver is already set in handleClick
    
    // Use SDK to trigger game over - simplified like chess.js
    if (!window.FarcadeSDK) return
    
    if (this.isMultiplayer) {
      // Build scores array for multiplayer - exactly like chess.js does
      const scores: Array<{ playerId: string; score: number }> = []
      
      // Ensure we have both players
      if (this.players && this.players.length >= 2) {
        scores.push({
          playerId: this.players[0].id,
          score: this.players[0].id === this.meId ? this.clickCount : this.otherPlayerClicks
        })
        scores.push({
          playerId: this.players[1].id, 
          score: this.players[1].id === this.meId ? this.clickCount : this.otherPlayerClicks
        })
      } else {
        // Fallback with default IDs
        scores.push({
          playerId: this.meId || '1',
          score: this.clickCount
        })
        scores.push({
          playerId: this.meId === '1' ? '2' : '1',
          score: this.otherPlayerClicks
        })
      }
      
      console.log(`[Player ${this.meId}] Triggering multiplayer game over with scores:`, scores)
      window.FarcadeSDK.multiplayer.actions.gameOver({ scores })
    } else {
      // Single player
      console.log(`Single player game over with score: ${this.clickCount}`)
      window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.clickCount })
    }
  }

  private restartGame(): void {
    this.clickCount = 0
    this.otherPlayerClicks = 0
    this.gameOver = false
    
    if (this.clickText) {
      this.clickText.setText('Score: 0/3')
    }
    
    // Reset all balls to new positions
    this.balls.forEach(ball => {
      ball.sprite.x = Phaser.Math.Between(ball.radius, GameSettings.canvas.width - ball.radius)
      ball.sprite.y = Phaser.Math.Between(ball.radius, GameSettings.canvas.height - ball.radius)
      ball.velocityX = Phaser.Math.Between(-300, 300)
      ball.velocityY = Phaser.Math.Between(-300, 300)
    })
    
    // Focus the canvas to enable keyboard input
    this.game.canvas.focus()
  }

  // --- Scene Shutdown Logic ---
  shutdown() {}
}