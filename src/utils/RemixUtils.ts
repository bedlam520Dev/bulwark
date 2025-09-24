// Dev environment info interface
interface DevEnvironmentInfo {
  packageManager: string;
  gameId: string;
  lastUpdated: number;
}

// Function to check if running inside the Remix iframe environment
export function isRemixEnvironment(): boolean {
  try {
    // Check for local development indicators
    const hostname = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
    
    // If we're on localhost, we're in local dev
    if (isLocalhost) {
      return false
    }
    
    // Otherwise assume we're in Remix environment (production, staging, or Remix iframe)
    return true
  } catch (e) {
    // If we can't determine, assume we're in Remix environment for safety
    return true
  }
}

// Function to get development environment information (only available in dev mode)
export function getDevEnvironmentInfo(): DevEnvironmentInfo | null {
  try {
    const devInfo = (window as any).__remixDevInfo;
    return devInfo || null;
  } catch (e) {
    return null;
  }
}


export function initializeRemixSDK(game: Phaser.Game): void {
  if (!("FarcadeSDK" in window && window.FarcadeSDK)) {
    return
  }

  // Make the game canvas focusable
  game.canvas.setAttribute("tabindex", "-1")

  // Signal ready state
  window.FarcadeSDK.singlePlayer.actions.ready()

  // Set mute/unmute handler
  window.FarcadeSDK.on("toggle_mute", (data: { isMuted: boolean }) => {
    game.sound.mute = data.isMuted
  })

  // Setup play_again handler
  window.FarcadeSDK.on("play_again", () => {
    // TODO: Restart the game
    // Your game restart logic is called here

    // Attempt to bring focus back to the game canvas
    try {
      game.canvas.focus()
    } catch (e) {
      // Could not programmatically focus game canvas
    }
  })
}

// Initialize development features (separate from SDK)
export function initializeDevelopment(): void {
  // Listen for dev info messages from the overlay
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'remix_dev_info') {
      (window as any).__remixDevInfo = event.data.data;
    }
  });

  // Load performance monitoring plugin after a short delay to ensure game is ready
  setTimeout(() => {
    loadRemixPerformancePlugin();
  }, 100);
}

// Load and inject the performance monitoring plugin
function loadRemixPerformancePlugin(): void {
  // Only load in development mode
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    // Fetch the plugin code from the .remix directory
    fetch('/.remix/plugins/performance-plugin.js')
      .then(response => {
        if (!response.ok) {
          throw new Error('Performance plugin not found');
        }
        return response.text();
      })
      .then(pluginCode => {
        // Execute the plugin code in the game context
        const script = document.createElement('script');
        script.textContent = pluginCode;
        document.head.appendChild(script);

        // The plugin code sets window.RemixPerformancePluginCode as a string
        // We need to evaluate it to actually run the plugin
        if ((window as any).RemixPerformancePluginCode) {
          const pluginScript = document.createElement('script');
          pluginScript.textContent = (window as any).RemixPerformancePluginCode;
          document.head.appendChild(pluginScript);
          
          // Clean up
          setTimeout(() => {
            if (pluginScript.parentNode) {
              pluginScript.parentNode.removeChild(pluginScript);
            }
          }, 100);
          
          // Log success for debugging
          console.log('[Remix Dev] Performance plugin loaded successfully');
        }

        // Clean up the script element
        setTimeout(() => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        }, 100);
      })
      .catch(error => {
        // Performance plugin loading failed, but this is non-critical
        console.log('Performance plugin not available (fallback mode will be used):', error.message);
      });
  } catch (error) {
    // Silently fail if plugin loading fails
    console.log('Performance plugin loading failed (fallback mode will be used)');
  }
}
