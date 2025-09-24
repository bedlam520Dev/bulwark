import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useDashboard } from '../../contexts'
import { usePerformanceMonitor, useUnderglow } from '../../hooks'
import { TopNavBar } from './TopNavBar'
import { CanvasControlBar } from './CanvasControlBar'
import { GameOverlay } from './GameOverlay'
import { cn, tw } from '../../utils/tw'
import '../../styles/app.css'

// Simple hook to check multiplayer flag
function useMultiplayerFlag() {
  const [isMultiplayer, setIsMultiplayer] = useState<boolean | null>(null)
  
  useEffect(() => {
    fetch('/package.json')
      .then(res => res.json())
      .then(pkg => setIsMultiplayer(pkg.multiplayer === true))
      .catch(() => setIsMultiplayer(false))
  }, [])
  
  return isMultiplayer
}

interface GameContainerProps {
  // Props can be added as needed
}

export const GameContainer: React.FC<GameContainerProps> = () => {
  const { state, dispatch } = useDashboard()
  const isMultiplayerFlag = useMultiplayerFlag()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframe2Ref = useRef<HTMLIFrameElement>(null)
  const gameFrameRef = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState({ width: 390, height: 844 })
  const [activeTab, setActiveTab] = useState<1 | 2>(1)
  const [useTabView, setUseTabView] = useState(false)
  
  // Set isMultiplayer with a default to avoid undefined
  // While loading (null), treat as multiplayer to prevent underglow initialization
  const isMultiplayer = isMultiplayerFlag === null ? true : isMultiplayerFlag
  

  // Initialize performance monitoring
  const { startMonitoring } = usePerformanceMonitor({ 
    iframe: iframeRef.current,
    updateInterval: 1000,
    maxDataPoints: 60
  })

  // Initialize underglow effect (disabled for multiplayer or while loading)
  const { toggle: toggleUnderglow } = useUnderglow(gameFrameRef as React.RefObject<HTMLElement>, { disabled: isMultiplayer })

  // Get turn indicator for player - checks game state for active turn
  const getTurnIndicator = (playerId: 1 | 2): boolean => {
    // Look for the most recent game state update from either player
    const gameStateEvents = state.sdk.events.filter(event => 
      event.type === 'game_state_updated' || event.type === 'multiplayer_game_state_broadcast'
    )
    
    const latestGameState = gameStateEvents[gameStateEvents.length - 1]
    
    // For game_state_updated events, the actual game data is nested in data.data
    const gameData = latestGameState?.data?.data || latestGameState?.data || {}
    
    if (gameData.currentPlayer !== undefined) {
      // Use the currentPlayer field from game state
      return gameData.currentPlayer === playerId
    } else if (gameData.turn !== undefined) {
      // Use the turn field from game state
      return gameData.turn === playerId
    } else if (gameData.activePlayer !== undefined) {
      // Use the activePlayer field from game state
      return gameData.activePlayer === playerId
    }
    
    // Default to player 1 if no turn data available
    return playerId === 1
  }

  // Calculate game frame size based on UI mode and multiplayer
  const updateGameFrameSize = useCallback(() => {
    // In multiplayer mode, we don't use gameFrameRef as there are multiple containers
    if (!isMultiplayer && !gameFrameRef.current) return

    const isMini = state.ui.isMiniMode
    let newFrameSize: { width: number; height: number }
    let shouldUseTabView = false

    if (isMini) {
      // Mini mode: use actual app size but respect screen boundaries
      const singleWidth = 393
      const actualWidth = isMultiplayer ? singleWidth * 2 + 20 : singleWidth // Double width for multiplayer + gap
      const actualHeight = 590 // Updated for 2:3 aspect ratio
      const containerHeight = window.innerHeight - 90 // Reserve space for status bar
      const containerWidth = window.innerWidth - 20 // Account for padding
      
      // Check if we should use tab view for multiplayer
      if (isMultiplayer && containerWidth < 700) {
        shouldUseTabView = true
        // In tab view, use single width
        newFrameSize = { width: Math.min(singleWidth, containerWidth), height: Math.min(actualHeight, containerHeight) }
      } else if (actualWidth <= containerWidth && actualHeight <= containerHeight) {
        // Use actual size if it fits
        newFrameSize = { width: actualWidth, height: actualHeight }
      } else {
        // Scale down proportionally to fit while maintaining aspect ratio
        const scaleByWidth = containerWidth / actualWidth
        const scaleByHeight = containerHeight / actualHeight
        const scale = Math.min(scaleByWidth, scaleByHeight)
        
        newFrameSize = {
          width: Math.floor(actualWidth * scale),
          height: Math.floor(actualHeight * scale)
        }
      }
    } else {
      // Full mode: calculate responsive size
      const containerHeight = window.innerHeight - 90 // Reserve space for status bar
      const baseWidth = Math.min(window.innerWidth - 20, containerHeight * (2 / 3)) // 2:3 aspect ratio
      
      // Check if we should use tab view for multiplayer
      if (isMultiplayer && window.innerWidth - 40 < 700) {
        shouldUseTabView = true
        // In tab view, use single width
        newFrameSize = {
          width: Math.min(baseWidth, window.innerWidth - 40),
          height: Math.min(baseWidth * (3 / 2), containerHeight)
        }
      } else {
        const containerWidth = isMultiplayer ? baseWidth * 2 + 20 : baseWidth // Double for multiplayer + gap
        const calculatedHeight = baseWidth * (3 / 2) // Height stays the same
        
        newFrameSize = {
          width: Math.min(containerWidth, window.innerWidth - 40),
          height: Math.min(calculatedHeight, containerHeight)
        }
      }
    }

    setFrameSize(newFrameSize)
    setUseTabView(shouldUseTabView)

    // Update global state
    dispatch({
      type: 'GAME_UPDATE',
      payload: { frameSize: newFrameSize }
    })
  }, [state.ui.isMiniMode, isMultiplayer, dispatch])

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    if (iframeRef.current) {
      startMonitoring()
    }
  }, [startMonitoring])

  // Set up global message listener for SDK events (outside of iframe load)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      
      // Check if message is from one of our game iframes
      const isFromPlayer1 = event.source === iframeRef.current?.contentWindow
      const isFromPlayer2 = isMultiplayer && event.source === iframe2Ref.current?.contentWindow
      
      if (isFromPlayer1 || isFromPlayer2) {
        const playerId = isFromPlayer1 ? '1' : '2'
        
        // Handle SDK events
        if (event.data?.type === 'remix_sdk_event') {
          const { event: sdkEvent } = event.data
          
          // Add event to dashboard state with player info
          dispatch({
            type: 'SDK_ADD_EVENT',
            payload: {
              type: sdkEvent.type,
              data: sdkEvent.data,
              playerId: playerId,
              timestamp: Date.now()
            }
          })

          // Update SDK flags based on event type
          const flagUpdates: Record<string, boolean> = {}
          switch (sdkEvent.type) {
            case 'ready':
              flagUpdates.ready = true
              break
            case 'game_state_updated':
            case 'update_game_state':
              // Game state updates are already handled by adding to events
              // No specific flags to update
              break
            case 'game_over':
            case 'multiplayer_game_over':
              flagUpdates.gameOver = true
              const gameOverScore = sdkEvent.data?.score || sdkEvent.data?.finalScore || 0
              
              
              dispatch({
                type: 'GAME_UPDATE',
                payload: { 
                  isGameOver: true,
                  score: gameOverScore,
                  playerId: playerId
                }
              })
              break
            case 'play_again':
              flagUpdates.playAgain = true
              
              // In multiplayer, DON'T sync play again - each game restarts independently
              dispatch({
                type: 'GAME_UPDATE',
                payload: { 
                  isGameOver: false, 
                  score: 0,
                  playerId: playerId
                }
              })
              break
            case 'toggle_mute':
              flagUpdates.toggleMute = true
              break
          }

          if (Object.keys(flagUpdates).length > 0) {
            dispatch({
              type: 'SDK_UPDATE_FLAGS',
              payload: flagUpdates
            })
          }
        }
        
        // Handle multiplayer game state broadcasts
        else if (event.data?.type === 'multiplayer_game_state_broadcast') {
          // Forward to the other iframe
          const otherIframe = isFromPlayer1 ? iframe2Ref.current : iframeRef.current
          if (otherIframe?.contentWindow) {
            otherIframe.contentWindow.postMessage(event.data, '*')
          }
        }
        
        // Handle performance data
        else if (event.data?.type === 'remix_performance_data') {
          // This will be handled by the performance monitor
        }
      }
    }

    window.addEventListener('message', handleMessage)
    
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [dispatch, isMultiplayer])

  // Update size on mount and window resize
  useEffect(() => {
    updateGameFrameSize()
    
    const handleResize = () => {
      updateGameFrameSize()
    }
    window.addEventListener('resize', handleResize)
    
    return () => window.removeEventListener('resize', handleResize)
  }, [updateGameFrameSize])

  // Update size when mini mode changes
  useEffect(() => {
    updateGameFrameSize()
  }, [state.ui.isMiniMode, updateGameFrameSize])

  // Keyboard toggle support (1:1 from original)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'u') {
        toggleUnderglow()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleUnderglow])

  // Development helper: Add manual testing functions (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Add global helper functions for manual testing
      window.testSDKEvent = (eventType: string, data?: any) => {
        
        // Simulate a message from the game iframe
        if (iframeRef.current?.contentWindow) {
          window.postMessage({
            type: 'remix_sdk_event',
            event: {
              type: eventType,
              data: data || {}
            }
          }, window.location.origin)
        }
      }
      
      window.resetSDKFlags = () => {
        dispatch({
          type: 'SDK_UPDATE_FLAGS',
          payload: { ready: false, gameOver: false, playAgain: false, toggleMute: false }
        })
      }
      
      return () => {
        delete window.testSDKEvent
        delete window.resetSDKFlags
      }
    }
  }, [dispatch])

  // Show loading state while determining multiplayer mode
  if (isMultiplayerFlag === null) {
    return (
      <div className={tw`
        relative flex-1 flex flex-col h-full
        px-[10px] items-center justify-center
        min-h-0
      `}>
        <div className={tw`text-gray-500`}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={tw`
      relative flex-1 flex flex-col h-full
      px-[10px] items-center justify-center
      min-h-0
    `}>
      <style>{`
        .game-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("");
          background-size: 150px 150px;
          background-repeat: repeat;
          opacity: 0;
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 0;
          transition: none;
        }
        
        body.show-background-pattern .game-container::before {
          opacity: var(--background-pattern-opacity, 0);
        }
        
        body.background-pattern-transitioning .game-container::before {
          transition: opacity 300ms ease-in-out;
        }
      `}</style>
      
      <div className={tw`
        relative flex flex-col items-center justify-center flex-1
      `} ref={isMultiplayer ? gameFrameRef : undefined}>
        {/* Player controls - tabs for narrow, labels for wide */}
        {isMultiplayer && (
          <div className={tw`
${useTabView ? 'flex justify-center gap-2' : 'flex gap-[10px]'} 
            mb-3 z-10
          `}>
            {useTabView ? (
              // Tab buttons for narrow screens
              <>
          <button 
            onClick={() => setActiveTab(1)}
            className={cn(
              tw`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                transition-all duration-200 border min-w-[80px] justify-center
                bg-[#1a1a1a] text-gray-300 hover:text-white
              `,
              activeTab === 1 
                ? tw`border-green-400`
                : tw`border-gray-600 hover:border-gray-500`
            )}
          >
            <span>Player 1</span>
            <div className={tw`
              w-2 h-2 rounded-full
              ${getTurnIndicator(1) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}
            `} />
          </button>
          <button 
            onClick={() => setActiveTab(2)}
            className={cn(
              tw`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                transition-all duration-200 border min-w-[80px] justify-center
                bg-[#1a1a1a] text-gray-300 hover:text-white
              `,
              activeTab === 2
                ? tw`border-green-400`
                : tw`border-gray-600 hover:border-gray-500`
            )}
          >
            <span>Player 2</span>
            <div className={tw`
              w-2 h-2 rounded-full
              ${getTurnIndicator(2) ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}
            `} />
          </button>
              </>
            ) : null}
          </div>
        )}
        {isMultiplayer ? (
          // Multiplayer layout - conditional based on useTabView
          useTabView ? (
            // Tabbed view for narrow screens - single container with control bar for active tab
            <div className={tw`flex flex-col items-center`}>
              <CanvasControlBar 
                playerId={activeTab === 1 ? '1' : '2'} 
                iframeId={activeTab === 1 ? 'game-iframe-1' : 'game-iframe-2'}
                isActive={getTurnIndicator(activeTab)}
              />
              <div 
                key="multiplayer-tabbed"
                className={tw`
                  relative overflow-hidden rounded-lg
                  border-2 border-[#99999905]
                  transition-[width,height] duration-normal ease-out
                  game-container
                `}
                style={{
                  width: `${frameSize.width}px`,
                  height: `${frameSize.height}px`,
                  zIndex: 1
                }}
                role="application"
                aria-label="Game container"
              >
                <div key="tab-container" style={{ position: 'absolute', inset: 0 }}>
                <div key="player-1-tab" style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  display: activeTab === 1 ? 'block' : 'none' 
                }}>
                  <iframe
                    ref={iframeRef}
                    id="game-iframe-1"
                    src="/?player=1&instance=1"
                    title="Player 1 game"
                    aria-label="Player 1 game frame"
                    onLoad={handleIframeLoad}
                    sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      zIndex: 2,
                      border: 'none'
                    }}
                  />
                  <GameOverlay playerId="1" />
                </div>
                
                <div key="player-2-tab" style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  display: activeTab === 2 ? 'block' : 'none' 
                }}>
                  <iframe
                    ref={iframe2Ref}
                    id="game-iframe-2"
                    src="/?player=2&instance=2"
                    title="Player 2 game"
                    aria-label="Player 2 game frame"
                    sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      zIndex: 2,
                      border: 'none'
                    }}
                  />
                  <GameOverlay playerId="2" />
                </div>
              </div>
              </div>
            </div>
          ) : (
            // Side-by-side view for wide screens - individual control bars for each container
            <div key="multiplayer-side-by-side" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              {/* Player 1 container with its own control bar */}
              <div className={tw`flex flex-col`}>
                <CanvasControlBar 
                  playerId="1" 
                  iframeId="game-iframe-1"
                  isActive={getTurnIndicator(1)}
                />
                  <div 
                  key="player-1-container"
                  className={tw`
                    relative overflow-hidden rounded-lg
                    border-2 border-[#99999905]
                    transition-[width,height] duration-normal ease-out
                    game-container
                  `}
                  style={{
                    width: `${frameSize.width / 2 - 5}px`,
                    height: `${frameSize.height}px`,
                    zIndex: 1
                  }}
                  role="application"
                  aria-label="Player 1 game container"
                >
                <iframe
                  ref={iframeRef}
                  id="game-iframe-1"
                  src="/?player=1&instance=1"
                  title="Player 1 game"
                  aria-label="Player 1 game frame"
                  onLoad={handleIframeLoad}
                  sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    zIndex: 2,
                    border: 'none'
                  }}
                />
                  <GameOverlay playerId="1" />
                </div>
              </div>
              
              {/* Player 2 container with its own control bar */}
              <div className={tw`flex flex-col`}>
                <CanvasControlBar 
                  playerId="2" 
                  iframeId="game-iframe-2"
                  isActive={getTurnIndicator(2)}
                />
                <div 
                  key="player-2-container"
                  className={tw`
                    relative overflow-hidden rounded-lg
                    border-2 border-[#99999905]
                    transition-[width,height] duration-normal ease-out
                    game-container
                  `}
                  style={{
                    width: `${frameSize.width / 2 - 5}px`,
                    height: `${frameSize.height}px`,
                    zIndex: 1
                  }}
                  role="application"
                  aria-label="Player 2 game container"
                >
                <iframe
                  ref={iframe2Ref}
                  id="game-iframe-2"
                  src="/?player=2&instance=2"
                  title="Player 2 game"
                  aria-label="Player 2 game frame"
                  sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    zIndex: 2,
                    border: 'none'
                  }}
                />
                <GameOverlay playerId="2" />
                </div>
              </div>
            </div>
          )
        ) : (
          // Single player: show 1 iframe with overlay
          <div className={tw`flex flex-col items-center`}>
            <TopNavBar />
            <div 
              key="singleplayer-container"
              className={tw`
                relative overflow-hidden rounded-lg
                border-2 border-[#99999905]
                transition-[width,height] duration-normal ease-out
                game-container
              `}
              ref={gameFrameRef}
              style={{
                width: `${frameSize.width}px`,
                height: `${frameSize.height}px`,
                zIndex: 1
              }}
              role="application"
              aria-label="Game container"
            >
              <iframe
                ref={iframeRef}
                id="game-iframe"
                src="/"
                title="Interactive game content"
                aria-label="Game preview frame"
                onLoad={handleIframeLoad}
                sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin allow-top-navigation-by-user-activation"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  zIndex: 2,
                  border: 'none'
                }}
              />
              <GameOverlay />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// TypeScript declaration for development helpers
declare global {
  interface Window {
    testSDKEvent?: (eventType: string, data?: any) => void
    resetSDKFlags?: () => void
  }
}
