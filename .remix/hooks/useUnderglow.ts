import { useEffect, useRef, useCallback } from 'react'
import { useDevSettings } from './useDevSettings'

// ===== UNDERGLOW CONFIGURATION ===== (1:1 from .remix/parent-underglow.ts)
const UNDERGLOW_CONFIG = {
  // === VISUAL APPEARANCE ===
  blurAmount: 22,            // Higher = softer glow (0-50)
  glowBrightness: .6,       // Higher = brighter glow (0-1)
  glowDistance: 12,          // How far glow extends beyond edges (pixels)
  
  // === PERFORMANCE ===
  updatesPerSecond: 30,     // How often to update the glow (1-60)
  
  // === TECHNICAL SETTINGS (Advanced) ===
  // Image capture
  horizontalDownscale: 2,   // Compress width by this factor (higher = faster)
  verticalDownscale: 2,     // Compress height by this factor (higher = faster)
  compressionQuality: 1,    // JPEG quality 1-100 (lower = faster)
  sampleSize: 10,           // Sample size for black frame detection
  blackFrameThreshold: 0.001, // Threshold for detecting black frames (0.001 = 0.1%)
  
  // Edge sampling (how much of each edge to sample from source)
  topEdgeSample: 80,        // Pixels from top of source (increased for smoother gradient)
  bottomEdgeSample: 80,     // Pixels from bottom of source  
  leftEdgeSample: 80,       // Pixels from left of source
  rightEdgeSample: 80,      // Pixels from right of source
}

interface UnderglowOptions {
  disabled?: boolean
}

export function useUnderglow(gameFrameRef: React.RefObject<HTMLElement>, options: UnderglowOptions = {}) {
  const { settings, capabilities } = useDevSettings()
  const isDisabled = options.disabled || false
  
  // Refs to match the exact structure of ParentUnderglow class
  const glowContainer = useRef<HTMLElement | null>(null)
  const glowCanvasTop = useRef<HTMLCanvasElement | null>(null)
  const glowCanvasBottom = useRef<HTMLCanvasElement | null>(null)
  const glowCanvasLeft = useRef<HTMLCanvasElement | null>(null)
  const glowCanvasRight = useRef<HTMLCanvasElement | null>(null)
  const glowCtxTop = useRef<CanvasRenderingContext2D | null>(null)
  const glowCtxBottom = useRef<CanvasRenderingContext2D | null>(null)
  const glowCtxLeft = useRef<CanvasRenderingContext2D | null>(null)
  const glowCtxRight = useRef<CanvasRenderingContext2D | null>(null)
  const animationId = useRef<number | null>(null)
  const lastUpdateTime = useRef<number>(0)
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const postMessageSender = useRef<(() => void) | null>(null)
  const enabled = useRef<boolean>(true)
  const pendingCapture = useRef<boolean>(false)
  const messageListener = useRef<((event: MessageEvent) => void) | null>(null)
  
  // Performance monitoring for adaptive quality
  const frameTimeHistory = useRef<number[]>([])
  const currentQuality = useRef<number>(1) // 1 = full quality, 0.5 = reduced
  const frameCount = useRef<number>(0)
  const lastStatusLog = useRef<number>(0)
  
  // Optimization: Reusable canvases for edge sampling
  const tempCanvasTop = useRef<HTMLCanvasElement | null>(null)
  const tempCanvasBottom = useRef<HTMLCanvasElement | null>(null)
  const tempCanvasLeft = useRef<HTMLCanvasElement | null>(null)
  const tempCanvasRight = useRef<HTMLCanvasElement | null>(null)
  const tempCtxTop = useRef<CanvasRenderingContext2D | null>(null)
  const tempCtxBottom = useRef<CanvasRenderingContext2D | null>(null)
  const tempCtxLeft = useRef<CanvasRenderingContext2D | null>(null)
  const tempCtxRight = useRef<CanvasRenderingContext2D | null>(null)
  
  
  // Configuration from config
  const updateInterval = useRef(1000 / UNDERGLOW_CONFIG.updatesPerSecond)
  const blurRadius = useRef(UNDERGLOW_CONFIG.blurAmount)
  const glowOpacity = useRef(UNDERGLOW_CONFIG.glowBrightness)
  const edgeThickness = useRef(UNDERGLOW_CONFIG.glowDistance)
  
  // Device detection (matching original)
  const isSafari = useRef(/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent))
  const isMobileDevice = useRef('ontouchstart' in window || navigator.maxTouchPoints > 0 || 
                               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

  // 1:1 port of isImageDataMostlyBlack from original
  const isImageDataMostlyBlack = useCallback((imageData: ImageData): boolean => {
    const data = imageData.data
    let nonBlackPixels = 0
    const totalPixels = data.length / 4
    
    // Check every pixel for any non-black content
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1] 
      const b = data[i + 2]
      
      // If any channel has some brightness, it's not black
      if (r > 0 || g > 0 || b > 0) {
        nonBlackPixels++
      }
    }
    
    // Accept frame if more than threshold of pixels are non-black (very lenient)
    const nonBlackPercentage = nonBlackPixels / totalPixels
    return nonBlackPercentage < UNDERGLOW_CONFIG.blackFrameThreshold
  }, [isDisabled])

  // 1:1 port of createGlowContainer from original
  const createGlowContainer = useCallback(() => {
    if (isDisabled || !gameFrameRef.current || glowContainer.current) return

    const parent = gameFrameRef.current.parentElement
    if (!parent) return

    // Check if there's already an underglow container (HMR safety)
    const existingContainer = parent.querySelector('.underglow-container')
    if (existingContainer) {
      existingContainer.remove()
    }

    // Create container
    glowContainer.current = document.createElement('div')
    glowContainer.current.className = 'underglow-container'
    glowContainer.current.style.position = 'relative'
    glowContainer.current.style.display = 'inline-block'
    
    // Move game frame into the container
    parent.insertBefore(glowContainer.current, gameFrameRef.current)
    glowContainer.current.appendChild(gameFrameRef.current)
    
    // Reset game frame positioning since it's now in a controlled container
    gameFrameRef.current.style.position = 'relative'
    gameFrameRef.current.style.zIndex = '2'
  }, [gameFrameRef, isDisabled])

  // 1:1 port of createEdgeCanvas from original
  const createEdgeCanvas = useCallback((edge: 'top' | 'bottom' | 'left' | 'right', rect: DOMRect): HTMLCanvasElement | null => {
    if (isDisabled || !gameFrameRef.current || !glowContainer.current) return null

    // Remove any existing underglow canvas for this edge (HMR safety)
    const existingCanvas = document.getElementById(`underglow-${edge}`)
    if (existingCanvas) {
      existingCanvas.remove()
    }

    const canvas = document.createElement('canvas')
    canvas.id = `underglow-${edge}`
    
    // Set dimensions based on edge
    if (edge === 'top' || edge === 'bottom') {
      // Extend top/bottom to cover the side glow areas
      canvas.width = rect.width + (2 * edgeThickness.current)
      canvas.height = edgeThickness.current
    } else {
      canvas.width = edgeThickness.current
      canvas.height = rect.height
    }
    
    // Position based on edge
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '0'
    canvas.style.filter = `blur(${blurRadius.current}px) brightness(1) saturate(1.25) contrast(0.9)`
    canvas.style.opacity = glowOpacity.current.toString()
    canvas.style.willChange = 'transform, opacity' // GPU optimization
    canvas.style.transform = 'translateZ(0)' // Force GPU layer
    
    switch (edge) {
      case 'top':
        canvas.style.top = `-${edgeThickness.current}px`
        canvas.style.left = `-${edgeThickness.current}px`
        canvas.style.width = `${rect.width + (2 * edgeThickness.current)}px`
        canvas.style.height = `${edgeThickness.current}px`
        break
      case 'bottom':
        canvas.style.top = `${rect.height}px`
        canvas.style.left = `-${edgeThickness.current}px`
        canvas.style.width = `${rect.width + (2 * edgeThickness.current)}px`
        canvas.style.height = `${edgeThickness.current}px`
        break
      case 'left':
        canvas.style.left = `-${edgeThickness.current}px`
        canvas.style.top = `0px`
        canvas.style.width = `${edgeThickness.current}px`
        canvas.style.height = `${rect.height}px`
        break
      case 'right':
        canvas.style.left = `${rect.width}px`
        canvas.style.top = `0px`
        canvas.style.width = `${edgeThickness.current}px`
        canvas.style.height = `${rect.height}px`
        break
    }
    
    // Insert glow canvas into the glow container
    glowContainer.current.appendChild(canvas)
    
    return canvas
  }, [gameFrameRef, isDisabled])

  // 1:1 port of createGlowCanvas from original
  const createGlowCanvas = useCallback(() => {
    if (isDisabled || !gameFrameRef.current || glowCanvasTop.current) return // Prevent duplicate creation

    // Create a container for game frame and glow
    createGlowContainer()

    // Get game frame dimensions
    const rect = gameFrameRef.current.getBoundingClientRect()
    
    // Create edge glow canvases
    glowCanvasTop.current = createEdgeCanvas('top', rect)
    glowCanvasBottom.current = createEdgeCanvas('bottom', rect)
    glowCanvasLeft.current = createEdgeCanvas('left', rect)
    glowCanvasRight.current = createEdgeCanvas('right', rect)
    
    // Get contexts
    glowCtxTop.current = glowCanvasTop.current?.getContext('2d', { alpha: true, willReadFrequently: true }) || null
    glowCtxBottom.current = glowCanvasBottom.current?.getContext('2d', { alpha: true, willReadFrequently: true }) || null
    glowCtxLeft.current = glowCanvasLeft.current?.getContext('2d', { alpha: true, willReadFrequently: true }) || null
    glowCtxRight.current = glowCanvasRight.current?.getContext('2d', { alpha: true, willReadFrequently: true }) || null
  }, [gameFrameRef, isDisabled, createGlowContainer, createEdgeCanvas])

  // 1:1 port of updateGlowCanvasSizes from original
  const updateGlowCanvasSizes = useCallback(() => {
    if (isDisabled || !gameFrameRef.current || !glowContainer.current) return

    const rect = gameFrameRef.current.getBoundingClientRect()
    
    // Update top canvas
    if (glowCanvasTop.current) {
      glowCanvasTop.current.width = rect.width + (2 * edgeThickness.current)
      glowCanvasTop.current.height = edgeThickness.current
      glowCanvasTop.current.style.width = `${rect.width + (2 * edgeThickness.current)}px`
      glowCanvasTop.current.style.height = `${edgeThickness.current}px`
    }

    // Update bottom canvas
    if (glowCanvasBottom.current) {
      glowCanvasBottom.current.width = rect.width + (2 * edgeThickness.current)
      glowCanvasBottom.current.height = edgeThickness.current
      glowCanvasBottom.current.style.width = `${rect.width + (2 * edgeThickness.current)}px`
      glowCanvasBottom.current.style.height = `${edgeThickness.current}px`
      glowCanvasBottom.current.style.top = `${rect.height}px`
    }

    // Update left canvas
    if (glowCanvasLeft.current) {
      glowCanvasLeft.current.width = edgeThickness.current
      glowCanvasLeft.current.height = rect.height
      glowCanvasLeft.current.style.width = `${edgeThickness.current}px`
      glowCanvasLeft.current.style.height = `${rect.height}px`
    }

    // Update right canvas
    if (glowCanvasRight.current) {
      glowCanvasRight.current.width = edgeThickness.current
      glowCanvasRight.current.height = rect.height
      glowCanvasRight.current.style.width = `${edgeThickness.current}px`
      glowCanvasRight.current.style.height = `${rect.height}px`
      glowCanvasRight.current.style.left = `${rect.width}px`
    }
  }, [gameFrameRef, isDisabled])

  // Enhanced setupPostMessageApproach to listen for Phaser postrender events
  const setupPostMessageApproach = useCallback((iframe: HTMLIFrameElement, autoStart: boolean = true) => {
    if (isDisabled) return
    // Set up message listener for Phaser postrender events if not already set
    if (!messageListener.current) {
      messageListener.current = (event: MessageEvent) => {
        // Only process messages from the game iframe
        if (event.source !== iframe.contentWindow) return
        
        // Listen for Phaser render complete signal
        if (event.data && event.data.type === 'phaser_render_complete') {
          // Canvas is ready, capture after a micro-task to ensure browser compositing is complete
          Promise.resolve().then(() => {
            if (pendingCapture.current && postMessageSender.current && enabled.current) {
              pendingCapture.current = false
              postMessageSender.current()
            }
          })
        }
      }
      
      window.addEventListener('message', messageListener.current)
    }
    
    // Inject code into the iframe to hook Phaser's postrender event
    const injectPhaserHook = () => {
      try {
        const iframeWindow = iframe.contentWindow
        if (!iframeWindow) return
        
        // Inject a script to hook into Phaser's render cycle
        const script = iframeWindow.document.createElement('script')
        script.textContent = `
          (function() {
            // Wait for Phaser game to be available
            const hookPhaser = () => {
              const game = window.game || window.phaserGame || (window.Phaser && window.Phaser.game);
              
              if (game && game.events) {
                // Expose game instance globally for debugging
                window.__phaserGame = game;
                
                // Hook into the postrender event
                game.events.on('postrender', () => {
                  // Get the canvas and its context
                  const canvas = game.canvas;
                  if (!canvas) return;
                  
                  const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('2d');
                  
                  if (ctx && ctx.flush) {
                    // Force WebGL to flush all pending operations
                    ctx.flush();
                  }
                  
                  // Double requestAnimationFrame to ensure browser compositing is complete
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      // Signal parent that render is complete and canvas is ready
                      window.parent.postMessage({ type: 'phaser_render_complete' }, '*');
                    });
                  });
                });
                
                // Successfully hooked into Phaser postrender event
              } else {
                // Retry in a moment
                setTimeout(hookPhaser, 100);
              }
            };
            
            hookPhaser();
          })();
        `
        iframeWindow.document.head.appendChild(script)
      } catch (e) {
        // Cross-origin, can't inject directly
        // Cross-origin, can't inject directly - will use fallback method
      }
    }
    
    // Try to inject the hook
    if (iframe.contentDocument || iframe.contentWindow) {
      injectPhaserHook()
    } else {
      // Wait for iframe to load
      iframe.addEventListener('load', injectPhaserHook, { once: true })
    }
    
    // Try to access iframe canvas directly
    const getIframeCanvas = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (iframeDoc) {
          const canvas = iframeDoc.querySelector('canvas') as HTMLCanvasElement
          
          // Check if canvas has WebGL context and ensure preserveDrawingBuffer
          if (canvas) {
            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
                      canvas.getContext('webgl2', { preserveDrawingBuffer: true })
            
            if (gl && gl.flush) {
              // Flush WebGL to ensure all operations are complete
              gl.flush()
            }
          }
          
          return canvas
        }
      } catch (e) {
        // Cross-origin - can't access directly
      }
      return null
    }

    // Initialize temp canvases if needed
    const initTempCanvases = () => {
      if (!tempCanvasTop.current) {
        tempCanvasTop.current = document.createElement('canvas')
        // Use willReadFrequently: true for better performance when reading from WebGL
        tempCtxTop.current = tempCanvasTop.current.getContext('2d', { willReadFrequently: true, alpha: true })
        
        tempCanvasBottom.current = document.createElement('canvas')
        tempCtxBottom.current = tempCanvasBottom.current.getContext('2d', { willReadFrequently: true, alpha: true })
        
        tempCanvasLeft.current = document.createElement('canvas')
        tempCtxLeft.current = tempCanvasLeft.current.getContext('2d', { willReadFrequently: true, alpha: true })
        
        tempCanvasRight.current = document.createElement('canvas')
        tempCtxRight.current = tempCanvasRight.current.getContext('2d', { willReadFrequently: true, alpha: true })
      }
    }

    // Optimized edge-only capture function with adaptive quality
    const captureCanvasData = () => {
      if (!enabled.current || pendingCapture.current) return
      
      // Set flag to prevent multiple captures
      pendingCapture.current = true

      const canvas = getIframeCanvas()
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        pendingCapture.current = false
        return
      }

      let startTime: number = performance.now()
      try {
          // Enhanced canvas readiness check for WebGL contexts
          // First try to get the appropriate context
          let ctx = canvas.getContext('2d', { willReadFrequently: false })
          const isWebGL = !ctx
          
          if (isWebGL) {
            // For WebGL, we need to ensure the buffer is preserved
            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
                      canvas.getContext('webgl2', { preserveDrawingBuffer: true })
            
            if (gl && gl.flush) {
              // Force flush to ensure rendering is complete
              gl.flush()
            }
            
            // Create a 2D context for sampling
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = Math.min(10, canvas.width)
            tempCanvas.height = Math.min(10, canvas.height)
            const tempCtx = tempCanvas.getContext('2d')
            
            if (tempCtx) {
              tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height)
              const sampleData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
              
              if (isImageDataMostlyBlack(sampleData)) {
                // Skip this frame if canvas is black
                return
              }
            }
          } else if (ctx) {
            // For 2D contexts, sample directly
            const sampleData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height))
            if (isImageDataMostlyBlack(sampleData)) {
              // Skip this frame if canvas is black
              return
            }
          }

          initTempCanvases()
          
          // Adaptive edge sampling based on performance
          const edgeSample = Math.round(UNDERGLOW_CONFIG.topEdgeSample * currentQuality.current)
          const downscale = currentQuality.current === 1 ? UNDERGLOW_CONFIG.horizontalDownscale : UNDERGLOW_CONFIG.horizontalDownscale * 1.5
          
          // Removed frame differencing - it was causing choppiness
          
          // Ensure WebGL content is ready before capturing
          const captureWithWebGLSync = () => {
            // Check if we're dealing with a WebGL context
            const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
                      canvas.getContext('webgl2', { preserveDrawingBuffer: true })
            
            if (gl && gl.flush) {
              // Force WebGL to complete all operations
              gl.flush()
              gl.finish && gl.finish() // Some implementations support finish() for complete sync
            }
          }
          
          // Sync WebGL before capturing
          captureWithWebGLSync()
          
          // Top edge - capture only what we need
          if (tempCanvasTop.current && tempCtxTop.current && glowCtxTop.current && glowCanvasTop.current) {
            tempCanvasTop.current.width = Math.ceil(canvas.width / downscale)
            tempCanvasTop.current.height = edgeSample
            tempCtxTop.current.imageSmoothingEnabled = true // Enable smoothing for better gradient
            tempCtxTop.current.drawImage(
              canvas,
              0, 0, canvas.width, edgeSample,
              0, 0, tempCanvasTop.current.width, tempCanvasTop.current.height
            )
            
            // Draw directly to glow canvas
            glowCtxTop.current.clearRect(0, 0, glowCanvasTop.current.width, glowCanvasTop.current.height)
            glowCtxTop.current.imageSmoothingEnabled = true
            glowCtxTop.current.drawImage(
              tempCanvasTop.current,
              0, 0, tempCanvasTop.current.width, tempCanvasTop.current.height,
              0, 0, glowCanvasTop.current.width, glowCanvasTop.current.height
            )
          }
          
          // Bottom edge
          if (tempCanvasBottom.current && tempCtxBottom.current && glowCtxBottom.current && glowCanvasBottom.current) {
            const bottomStart = Math.max(0, canvas.height - edgeSample)
            tempCanvasBottom.current.width = Math.ceil(canvas.width / UNDERGLOW_CONFIG.horizontalDownscale)
            tempCanvasBottom.current.height = edgeSample
            tempCtxBottom.current.imageSmoothingEnabled = true // Enable smoothing for better gradient
            tempCtxBottom.current.drawImage(
              canvas,
              0, bottomStart, canvas.width, edgeSample,
              0, 0, tempCanvasBottom.current.width, tempCanvasBottom.current.height
            )
            
            glowCtxBottom.current.clearRect(0, 0, glowCanvasBottom.current.width, glowCanvasBottom.current.height)
            glowCtxBottom.current.imageSmoothingEnabled = true
            glowCtxBottom.current.drawImage(
              tempCanvasBottom.current,
              0, 0, tempCanvasBottom.current.width, tempCanvasBottom.current.height,
              0, 0, glowCanvasBottom.current.width, glowCanvasBottom.current.height
            )
          }
          
          // Left edge
          if (tempCanvasLeft.current && tempCtxLeft.current && glowCtxLeft.current && glowCanvasLeft.current) {
            tempCanvasLeft.current.width = edgeSample
            tempCanvasLeft.current.height = Math.ceil(canvas.height / UNDERGLOW_CONFIG.verticalDownscale)
            tempCtxLeft.current.imageSmoothingEnabled = true // Enable smoothing for better gradient
            tempCtxLeft.current.drawImage(
              canvas,
              0, 0, edgeSample, canvas.height,
              0, 0, tempCanvasLeft.current.width, tempCanvasLeft.current.height
            )
            
            glowCtxLeft.current.clearRect(0, 0, glowCanvasLeft.current.width, glowCanvasLeft.current.height)
            glowCtxLeft.current.imageSmoothingEnabled = true
            glowCtxLeft.current.drawImage(
              tempCanvasLeft.current,
              0, 0, tempCanvasLeft.current.width, tempCanvasLeft.current.height,
              0, 0, glowCanvasLeft.current.width, glowCanvasLeft.current.height
            )
          }
          
          // Right edge
          if (tempCanvasRight.current && tempCtxRight.current && glowCtxRight.current && glowCanvasRight.current) {
            const rightStart = Math.max(0, canvas.width - edgeSample)
            tempCanvasRight.current.width = edgeSample
            tempCanvasRight.current.height = Math.ceil(canvas.height / UNDERGLOW_CONFIG.verticalDownscale)
            tempCtxRight.current.imageSmoothingEnabled = true // Enable smoothing for better gradient
            tempCtxRight.current.drawImage(
              canvas,
              rightStart, 0, edgeSample, canvas.height,
              0, 0, tempCanvasRight.current.width, tempCanvasRight.current.height
            )
            
            glowCtxRight.current.clearRect(0, 0, glowCanvasRight.current.width, glowCanvasRight.current.height)
            glowCtxRight.current.imageSmoothingEnabled = true
            glowCtxRight.current.drawImage(
              tempCanvasRight.current,
              0, 0, tempCanvasRight.current.width, tempCanvasRight.current.height,
              0, 0, glowCanvasRight.current.width, glowCanvasRight.current.height
            )
          }
          
      } catch (error) {
        // Failed to capture canvas - likely a timing issue
        // Failed to capture canvas - will retry next frame
      } finally {
        // Always clear the pending flag
        pendingCapture.current = false
        
        // Track frame time for adaptive quality
        const frameTime = performance.now() - startTime
        frameTimeHistory.current.push(frameTime)
        if (frameTimeHistory.current.length > 30) {
          frameTimeHistory.current.shift()
        }
        
        // Log status every 5 seconds
        frameCount.current++
        const now = Date.now()
        if (now - lastStatusLog.current > 5000) {
          const avgFrameTime = frameTimeHistory.current.reduce((a, b) => a + b, 0) / frameTimeHistory.current.length
          // Performance tracking: Avg frame time and quality adjustment
          lastStatusLog.current = now
        }
        
        // Adjust quality if consistently slow or fast
        if (frameTimeHistory.current.length >= 10) {
          const avgFrameTime = frameTimeHistory.current.reduce((a, b) => a + b, 0) / frameTimeHistory.current.length
          
          if (avgFrameTime > 8 && currentQuality.current > 0.5) {
            // Reduce quality if frame time is too high
            currentQuality.current = 0.75
          } else if (avgFrameTime < 3 && currentQuality.current < 1) {
            // Increase quality if we have headroom
            currentQuality.current = 1
          }
        }
    }
    
    // Set up message listener for Phaser postrender events
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'phaser-postrender' && enabled.current) {
        captureCanvasData()
      }
    }
    
    messageListener.current = handleMessage
    window.addEventListener('message', handleMessage)
    }
    
    // Store the capture function
    postMessageSender.current = captureCanvasData
  }, [isImageDataMostlyBlack])

  // Removed updateGlowFromJpeg and updateAllEdges - now drawing directly in capture function

  // 1:1 port of setupCrossFrameCanvas from original
  const setupCrossFrameCanvas = useCallback((iframe: HTMLIFrameElement) => {
    if (isDisabled) return
    // Create glow canvas immediately (don't wait for iframe canvas)
    createGlowCanvas()
    
    // Set up postMessage communication
    setupPostMessageApproach(iframe, true)
    
    // Auto-start if enabled
    if (enabled.current) {
      start()
    }
  }, [createGlowCanvas, setupPostMessageApproach, isDisabled])

  // 1:1 port of setupResizeObserver from original
  const setupResizeObserver = useCallback(() => {
    if (isDisabled || !gameFrameRef.current || resizeObserver.current) return

    resizeObserver.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === gameFrameRef.current) {
          updateGlowCanvasSizes()
        }
      }
    })

    resizeObserver.current.observe(gameFrameRef.current)
  }, [gameFrameRef, isDisabled, updateGlowCanvasSizes])

  // Optimized update loop using requestAnimationFrame for smoother updates
  const startPostMessageUpdates = useCallback(() => {
    if (!enabled.current || !postMessageSender.current || isSafari.current || isMobileDevice.current) return

    const updateLoop = () => {
      if (!enabled.current) return
      
      const now = performance.now()
      
      // Only update at specified FPS intervals and if not already pending
      if (now - lastUpdateTime.current >= updateInterval.current && !pendingCapture.current) {
        // Set pending flag and request new canvas data
        pendingCapture.current = true
        if (postMessageSender.current) {
          postMessageSender.current()
        }
        lastUpdateTime.current = now
      }
      
      // Use requestAnimationFrame for smoother updates aligned with browser paint
      animationId.current = requestAnimationFrame(updateLoop) as any
    }
    
    updateLoop()
  }, [isDisabled])

  // 1:1 port of start from original with Safari/mobile checks
  const start = useCallback(() => {
    // Don't start on Safari or mobile devices or when disabled
    if (isDisabled || isSafari.current || isMobileDevice.current || !glowCanvasTop.current) return
    
    // Show all edge canvases
    if (glowCanvasTop.current) glowCanvasTop.current.style.display = 'block'
    if (glowCanvasBottom.current) glowCanvasBottom.current.style.display = 'block'
    if (glowCanvasLeft.current) glowCanvasLeft.current.style.display = 'block'
    if (glowCanvasRight.current) glowCanvasRight.current.style.display = 'block'
    
    if (postMessageSender.current) {
      startPostMessageUpdates()
    }
  }, [startPostMessageUpdates])

  // Updated stop to handle requestAnimationFrame
  const stop = useCallback(() => {
    if (isDisabled) return
    if (animationId.current) {
      cancelAnimationFrame(animationId.current as number)
      animationId.current = null
    }
    
    // Hide all edge canvases
    if (glowCanvasTop.current) glowCanvasTop.current.style.display = 'none'
    if (glowCanvasBottom.current) glowCanvasBottom.current.style.display = 'none'
    if (glowCanvasLeft.current) glowCanvasLeft.current.style.display = 'none'
    if (glowCanvasRight.current) glowCanvasRight.current.style.display = 'none'
  }, [isDisabled])

  // 1:1 port of waitForDevOverlay from original
  const waitForDevOverlay = useCallback(() => {
    if (isDisabled) return
    
    let attempts = 0
    const maxAttempts = 50
    
    const checkForStructure = () => {
      attempts++
      
      if (gameFrameRef.current) {
        // Look for iframe within game frame
        const iframe = gameFrameRef.current.querySelector('iframe') as HTMLIFrameElement
        if (iframe) {
          setupCrossFrameCanvas(iframe)
        } else {
          createGlowCanvas()
        }
        // Auto-start if enabled and not on Safari/mobile
        if (enabled.current && !isSafari.current && !isMobileDevice.current) {
          start()
        }
        
        // Setup resize observer to handle canvas size changes
        setupResizeObserver()
      } else if (attempts < maxAttempts) {
        setTimeout(checkForStructure, 100)
      } else {
        // Gave up waiting for structure
      }
    }
    
    checkForStructure()
  }, [gameFrameRef, isDisabled, setupCrossFrameCanvas, createGlowCanvas, start, setupResizeObserver])

  // 1:1 port of toggle from original
  const toggle = useCallback(() => {
    // Don't allow toggling in Safari or on mobile devices or when disabled
    if (isDisabled || isSafari.current || isMobileDevice.current) {
      return
    }
    
    enabled.current = !enabled.current
    
    if (enabled.current) {
      start()
    } else {
      stop()
    }
  }, [start, stop, isDisabled])

  // Cleanup method (1:1 port of destroy from original)
  const cleanup = useCallback(() => {
    // Always safe to call - checks before doing DOM manipulation
    if (resizeObserver.current) {
      resizeObserver.current.disconnect()
      resizeObserver.current = null
    }
    
    if (animationId.current) {
      cancelAnimationFrame(animationId.current as number)
      animationId.current = null
    }
    
    // Clean up message listener
    if (messageListener.current) {
      window.removeEventListener('message', messageListener.current)
      messageListener.current = null
    }

    // Remove DOM elements before resetting refs
    if (glowCanvasTop.current) {
      glowCanvasTop.current.remove()
    }
    if (glowCanvasBottom.current) {
      glowCanvasBottom.current.remove()
    }
    if (glowCanvasLeft.current) {
      glowCanvasLeft.current.remove()
    }
    if (glowCanvasRight.current) {
      glowCanvasRight.current.remove()
    }
    
    // Remove underglow container if it exists and restore original structure
    // Only do DOM manipulation if glowContainer was actually created and contains gameFrameRef
    if (glowContainer.current && gameFrameRef.current && glowContainer.current.contains(gameFrameRef.current)) {
      const parent = glowContainer.current.parentElement
      if (parent) {
        // Move game frame back to original parent
        parent.insertBefore(gameFrameRef.current, glowContainer.current)
        // Remove the container
        glowContainer.current.remove()
      }
    }

    // Reset all refs
    glowContainer.current = null
    glowCanvasTop.current = null
    glowCanvasBottom.current = null
    glowCanvasLeft.current = null
    glowCanvasRight.current = null
    glowCtxTop.current = null
    glowCtxBottom.current = null
    glowCtxLeft.current = null
    glowCtxRight.current = null
    postMessageSender.current = null
    pendingCapture.current = false
    messageListener.current = null
  }, [gameFrameRef])

  // Initialize underglow (1:1 port of initialize from original)
  useEffect(() => {
    if (isDisabled) return
    
    // Detect Safari browser (specifically Safari, not Chrome or other WebKit browsers)
    isSafari.current = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    
    // Detect mobile touch devices
    isMobileDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || 
                         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isSafari.current || isMobileDevice.current) {
      enabled.current = false
      return
    }

    // Wait for dev overlay to create the structure
    waitForDevOverlay()

    // Return cleanup - it's safe to call anytime
    return cleanup
  }, [waitForDevOverlay, cleanup, isDisabled])
  
  // Visibility API - pause when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause underglow to save resources
        if (enabled.current && animationId.current) {
          stop()
        }
      } else {
        // Tab is visible again - resume if it was enabled
        if (enabled.current && settings.canvasGlow && capabilities.supportsUnderglow) {
          start()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [settings.canvasGlow, capabilities.supportsUnderglow, start, stop])

  // Start/stop based on settings
  useEffect(() => {
    if (!isDisabled && settings.canvasGlow && capabilities.supportsUnderglow && enabled.current) {
      start()
    } else {
      stop()
    }
  }, [settings.canvasGlow, capabilities.supportsUnderglow, start, stop, isDisabled])
  
  // Clean up when disabled changes to true
  useEffect(() => {
    if (isDisabled) {
      stop()
      cleanup()
      
      // Extra cleanup - remove any stray underglow elements
      const underglowElements = document.querySelectorAll('[id^="underglow-"]')
      underglowElements.forEach(el => {
        el.remove()
      })
      
      // Remove glow container if it exists
      const glowContainers = document.querySelectorAll('.underglow-container')
      glowContainers.forEach(el => {
        el.remove()
      })
    }
  }, [isDisabled, stop, cleanup])

  return {
    isEnabled: !isDisabled && settings.canvasGlow && capabilities.supportsUnderglow && enabled.current,
    isSupported: !isDisabled && capabilities.supportsUnderglow && !isSafari.current && !isMobileDevice.current,
    toggle: isDisabled ? () => {} : toggle,
    start,
    stop,
    cleanup
  }
}