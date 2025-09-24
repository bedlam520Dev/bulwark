import { GameScene } from "./scenes/GameScene"
import { initializeRemixSDK, initializeDevelopment } from "./utils/RemixUtils"
import { initializeSDKMock } from "../.remix/mocks/RemixSDKMock"
import GameSettings from "./config/GameSettings"

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL, // Using WebGL for shader support
  width: GameSettings.canvas.width,
  height: GameSettings.canvas.height,
  scale: {
    mode: Phaser.Scale.FIT,
    parent: document.body,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GameSettings.canvas.width,
    height: GameSettings.canvas.height,
  },
  backgroundColor: "#1a1a1a",
  scene: [GameScene],
  physics: {
    default: "arcade",
  },
  // Target frame rate
  fps: {
    target: 60,
  },
  // Additional WebGL settings
  pixelArt: false,
  antialias: true,
  // Preserve drawing buffer for underglow effect
  render: {
    preserveDrawingBuffer: true,
  },
}

// Initialize the application
async function initializeApp() {
  // Initialize SDK mock in development
  if (process.env.NODE_ENV !== 'production') {
    await initializeSDKMock()
  }

  // Create the game instance
  const game = new Phaser.Game(config)

  // Expose game globally for performance plugin
  ;(window as any).game = game

  // Initialize Remix SDK and development features
  game.events.once("ready", () => {
    initializeRemixSDK(game)
    
    // Initialize development features (only active in dev mode)
    if (process.env.NODE_ENV !== 'production') {
      initializeDevelopment()
    }
  })
}

// Start the application
initializeApp().catch(console.error)
