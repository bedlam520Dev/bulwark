import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '../../contexts'
import { cn, tw } from '../../utils/tw'

interface GameStatePanelProps {
  isOpen: boolean
}

// Get a unique key for this game based on the path
function getGameStateKey() {
  const path = window.location.pathname || '/'
  const cleanPath = path.replace(/[^a-zA-Z0-9-]/g, '_').replace(/^_+|_+$/g, '') || 'default'
  return `remix_game_state_${cleanPath}`
}

// Load game state from localStorage
function loadGameStateFromStorage() {
  try {
    const key = getGameStateKey()
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log(`GameStatePanel: Loaded state from ${key}:`, parsed)
      // Handle different formats of stored state
      if (parsed?.gameState?.data) {
        return parsed.gameState.data
      } else if (parsed?.gameState) {
        return parsed.gameState
      } else if (parsed?.moves) {
        // Direct game state object
        return parsed
      }
      return null
    }
  } catch (e) {
    console.error('GameStatePanel: Failed to load state from storage:', e)
  }
  return null
}

export const GameStatePanel: React.FC<GameStatePanelProps> = ({ isOpen }) => {
  const { state } = useDashboard()
  const [gameState, setGameState] = useState<any>(() => {
    // Initialize with persisted state if available
    return loadGameStateFromStorage()
  })
  const [textContent, setTextContent] = useState<string>(() => {
    const initial = loadGameStateFromStorage()
    return initial ? JSON.stringify(initial, null, 2) : ''
  })
  const [parseError, setParseError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-save function with validation
  const autoSave = useCallback((text: string) => {
    try {
      const parsedState = JSON.parse(text)
      setParseError(null)
      setGameState(parsedState)
      
      // Ensure the state has a timestamp
      if (!parsedState.timestamp) {
        parsedState.timestamp = Date.now()
      }
      
      // Save to localStorage
      const key = getGameStateKey()
      const stateToSave = {
        gameState: { id: Date.now().toString(), data: parsedState },
        players: parsedState.players || [
          { id: '1', name: 'Player 1', imageUrl: undefined },
          { id: '2', name: 'Player 2', imageUrl: undefined }
        ],
        currentPlayerId: null
      }
      localStorage.setItem(key, JSON.stringify(stateToSave))
      
      // Update parent window state if accessible
      if (window.parent !== window) {
        try {
          const parentWindow = window.parent as any
          parentWindow.__remixGameState = stateToSave
        } catch (e) {
          console.error('Cannot update parent window state:', e)
        }
      }
      
      // Reload both iframes to ensure they properly initialize with the new state
      const iframes = document.querySelectorAll('iframe')
      iframes.forEach((iframe, index) => {
        if (iframe.contentWindow) {
          console.log(`Reloading iframe ${index + 1} with new game state...`)
          iframe.contentWindow.location.reload()
        }
      })
      
      console.log('Game state auto-saved to localStorage and iframes reloaded:', parsedState)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid JSON')
    }
  }, [])

  // Handle text changes with debounce
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setTextContent(newText)
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new timer for auto-save (500ms delay)
    if (newText.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        autoSave(newText)
      }, 500)
    }
  }, [autoSave])

  // Listen for game state updates from multiplayer games
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'multiplayer_game_state_broadcast') {
        // The gameState has {id, data} structure
        const newState = event.data.gameState?.data || event.data.gameState
        setGameState(newState)
        setTextContent(JSON.stringify(newState, null, 2))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])
  
  // Listen for localStorage changes from other windows/iframes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const gameKey = getGameStateKey()
      if (e.key === gameKey) {
        console.log('GameStatePanel: Storage event detected for', gameKey)
        const storedState = loadGameStateFromStorage()
        if (storedState) {
          setGameState(storedState)
          setTextContent(JSON.stringify(storedState, null, 2))
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  
  // Check for updates when panel opens
  useEffect(() => {
    if (!isOpen) return
    
    const checkForUpdates = () => {
      const storedState = loadGameStateFromStorage()
      if (storedState) {
        const currentStateStr = JSON.stringify(gameState)
        const storedStateStr = JSON.stringify(storedState)
        
        if (currentStateStr !== storedStateStr) {
          console.log('GameStatePanel: Detected state change from localStorage')
          setGameState(storedState)
          setTextContent(JSON.stringify(storedState, null, 2))
        }
      }
    }
    
    // Check immediately when panel opens
    checkForUpdates()
    
    // Also check periodically (less frequently - every 5 seconds)
    const interval = setInterval(checkForUpdates, 5000)
    
    return () => clearInterval(interval)
  }, [isOpen, gameState])

  // Also check SDK events for game state updates
  useEffect(() => {
    const gameStateEvents = state.sdk.events.filter(event => 
      event.type === 'game_state_updated'
    )
    const latestGameState = gameStateEvents[gameStateEvents.length - 1]
    if (latestGameState) {
      setGameState(latestGameState.data)
      setTextContent(JSON.stringify(latestGameState.data, null, 2))
    }
  }, [state.sdk.events])

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the game state? This will start a new game.')) {
      // Clear the game state
      setGameState(null)
      setTextContent('')
      
      // Clear from localStorage FIRST before reloading
      const key = getGameStateKey()
      localStorage.removeItem(key)
      console.log(`Removed game state from localStorage: ${key}`)
      
      // Clear from parent window if accessible
      if (window.parent !== window) {
        try {
          const parentWindow = window.parent as any
          // Completely clear the stored state
          delete parentWindow.__remixGameState
          console.log('Cleared parent window game state')
        } catch (e) {
          console.error('Cannot clear parent window state:', e)
        }
      }
      
      // Wait a moment to ensure storage is cleared, then reload iframes
      setTimeout(() => {
        const iframes = document.querySelectorAll('iframe')
        iframes.forEach((iframe, index) => {
          if (iframe.contentWindow) {
            console.log(`Reloading iframe ${index + 1} to start fresh...`)
            iframe.contentWindow.location.reload()
          }
        })
      }, 100)
      
      console.log('Game state cleared - reloading both games')
    }
  }

  return (
    <div 
      className={tw`
        fixed top-0 right-0 w-96 h-[calc(100%-70px)]
        bg-bg-secondary border-l border-border-default
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        transition-transform duration-300 ease-in-out
        flex flex-col overflow-hidden z-[100]
        md:w-96 max-md:w-full
      `}
      role="region"
      aria-label="Game state panel"
      aria-expanded={isOpen}
    >
      <div className={tw`
        flex-1 p-6 pb-8 overflow-hidden
        flex flex-col gap-6 min-h-0
      `}>
        {/* Panel Header */}
        <div className="flex items-center justify-between w-full flex-shrink-0">
          <h3 className="text-white text-lg font-semibold m-0">Game State</h3>
          <div className={tw`flex items-center gap-2`}>
            <button
              onClick={() => {
                if (textContent) {
                  navigator.clipboard.writeText(textContent)
                  console.log('Game state copied to clipboard')
                }
              }}
              className={tw`
                text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded
                font-medium transition-colors cursor-pointer border-0
              `}
              title="Copy game state to clipboard"
            >
              Copy
            </button>
            <button
              onClick={handleClear}
              className={tw`
                text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded
                font-medium transition-colors cursor-pointer border-0
              `}
              title="Clear game state and start fresh"
            >
              Clear
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div className={tw`
          flex-1 overflow-hidden flex flex-col min-h-0
        `}>
          <div className={tw`
            flex-1 overflow-hidden flex flex-col
            font-mono text-xs leading-relaxed
          `}>
            <div className={tw`
              border border-border-default rounded-md overflow-hidden
              flex-1 flex flex-col relative bg-bg-primary
            `}>
              <textarea
                value={textContent}
                onChange={handleTextChange}
                placeholder="Game state will appear here when the game starts..."
                className={tw`
                  font-mono text-xs leading-[1.5] p-4 m-0
                  text-gray-300 bg-transparent whitespace-pre
                  resize-none outline-none border-0
                  h-full w-full box-border
                  ${parseError ? 'text-red-400' : ''}
                  placeholder:text-gray-600
                `}
                spellCheck={false}
              />
              {parseError && (
                <div className={tw`
                  absolute bottom-0 left-0 right-0
                  bg-red-500 text-white text-xs px-3 py-2
                `}>
                  JSON Error: {parseError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}