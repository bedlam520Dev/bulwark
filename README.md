# Remix Game Template - Phaser.js + TypeScript

## Overview

A TypeScript and Phaser.js template for creating mobile games on the Remix platform. Features 2:3 aspect ratio for exact mini-app dimensions, professional development environment with SDK testing, and comprehensive HTML5 game tooling.

## Features

- 📱 Mobile-first 2:3 aspect ratio design
- 🎮 Phaser.js framework (CDN-loaded)
- 🔧 TypeScript support with type safety
- 🔄 Hot-reload dev server with QR code mobile testing
- 🎛️ **Professional Development Environment**:
  - Advanced SDK integration testing with 2x2 grid status indicators
  - Real-time performance monitoring with interactive FPS charts
  - Phone frame simulation with game overlay
  - Intelligent canvas scaling with mobile-optimized responsive design
  - Build your game and copy the minified HTML code without leaving the dashboard
- 📦 Optimized Remix platform build process
- 🎨 Test game scene to show successful setup
- ⚒️ Setup script to get you running in 1 easy command

## What You Need Before Starting

### Required Software:
1. **Node.js** - Download LTS version from [nodejs.org](https://nodejs.org)
   - Includes `npm` package manager
   - Install via downloaded installer or package manager

2. **Code Editor** (recommended):
   - [Visual Studio Code](https://code.visualstudio.com) - free, beginner-friendly
   - [Cursor](https://cursor.sh) - VS Code with AI assistance

3. **Terminal/Command Line** - You'll need to navigate folders and run commands

## ⚠️ Important Notes

- **Phaser.js is loaded from CDN**: The game framework is loaded in `index.html`, so Phaser is globally available. **Never add Phaser imports** to your TypeScript files - this will break your game.
- **Mobile-First**: This template is designed for Farcaster mini-apps with a 2:3 aspect ratio.
- **Development Environment**: The template includes a comprehensive development overlay that simulates the Remix platform environment.

## Quick Start (Step-by-Step)

### Step 1: Get the Template
```bash
# Option A: Clone with git (if you have git installed)
git clone https://github.com/InsideTheSim/remix-starter-ts-phaser my-game-name
cd my-game-name

# Option B: Download as ZIP
# Download the ZIP file from GitHub, extract it, and open Terminal/Command Prompt in that folder. 
# Download available at:
https://github.com/InsideTheSim/remix-starter-ts-phaser
```

### Step 2: Run Setup
```bash
npm run remix-setup
```

**What this does:**
- Detects your package manager (npm/yarn/pnpm/bun)
- Safely removes template git history
- Installs dependencies and creates fresh git repo
- Removes safety marker file

**⚠️ Safety:** Only runs once on fresh templates. Once run, cannot be run again.

### Step 3: Start Development
```bash
npm run dev
```

**What happens:**
- Server starts at `localhost:3000` with QR code for mobile testing
- Browser opens with **Remix Development Overlay**:
  - Mini-app simulation (2:3 aspect ratio)
  - Remix SDK status panel (red/yellow/green indicators)
  - Full/Actual size toggle for testing game at actual mini-app scale
  - Remix "Game Over" Overlay simulation to test game restart loop
- File changes auto-refresh browser

### Step 4: Test on Your Phone
1. Make sure your phone is on the same Wi-Fi network as your computer
2. Scan the QR code that appears in your terminal
3. The game opens in your phone's browser
4. Test your touch controls

<details>
<summary><strong>📦 Porting an Existing Game (Click to expand)</strong></summary>

If you have an existing game that you want to port to this starter template then follow these steps:

### Step 1: Complete the Quick Start Setup
Follow the Quick Start steps above to set up the template first.

### Step 2: Prepare Your Existing Game Code
1. Create a new folder in the project root called `src_prev` (as a sibling to the `src` folder):
   ```bash
   mkdir src_prev
   ```

2. Copy all your existing game files into the `src_prev` folder:
   ```
   your-project/
   ├── src/                    # New template structure
   ├── src_prev/           # Your existing game code
   │   ├── scenes/
   │   ├── objects/
   │   ├── assets/
   │   └── ... (all your existing files)
   └── ...
   ```

### Step 3: Ask Your LLM Assistant to Help Migrate
Once your existing code is in the `src_prev` folder, ask your AI assistant (like Claude Code) to help you migrate:

> "I have an existing Phaser.js game in the `src_prev` folder that I want to port to this Remix template. Please help me migrate the code into the proper `src` structure, ensuring it works with the 2:3 aspect ratio and Remix platform requirements. Please analyze my existing game structure and guide me through the migration process."

### ⚠️ Important Migration Reality Check:
**Things WILL break during migration!** This is completely normal and expected. Game porting is an iterative process that requires multiple rounds of fixes:

- **Expect compilation errors** - TypeScript and build issues are common
- **Expect runtime crashes** - Games may not start immediately after migration
- **Expect visual/gameplay issues** - Aspect ratio changes affect game layout
- **Be prepared for multiple LLM conversations** - You'll need to ask follow-up questions like:
  - "Fix this TypeScript error: [paste error]"
  - "The game crashes with this error: [paste error]"
  - "Help me adjust the UI layout for 5:9 aspect ratio"
  - "My touch controls aren't working, can you help?"

**Migration is a collaborative process** - Plan to spend time working with your AI assistant to resolve issues step by step. Don't expect a perfect one-shot migration.

### Migration Considerations:
- **Aspect Ratio**: Your game will need to adapt to the 2:3 mobile format
- **Asset Loading**: Assets may need to be restructured for the build process
- **Phaser Imports**: Remove any Phaser imports since it's loaded globally via CDN
- **Platform Integration**: Add Remix SDK integration for platform features
- **Mobile Optimization**: Ensure touch controls and mobile performance
- **Development Testing**: Use the new development overlay to verify SDK integration

### Step 4: Clean Up
After successful migration, you can remove the `src_prev` folder:
```bash
rm -rf src_prev
```

**💡 Pro Tip**: Keep your original game backup in a separate location until you're confident the migration is complete and working properly.

</details>

## Development Environment

### Understanding the Development Overlay

The template includes a comprehensive development environment that simulates the Remix platform:

#### **Visual SDK Integration Testing**
- **2x2 Grid Status Indicator**: Visual grid showing individual integration status at a glance
  - Each mini-light represents one SDK event: `ready`, `game_over`, `play_again`, `toggle_mute`
  - 🔴 Red: Event not triggered yet
  - 🟢 Green: Event has been triggered
- **Detailed Status Panel**: Hover or tap "Remix SDK integration" to see detailed event status
- **Real-time Updates**: Both grid and panel update instantly when SDK events are triggered

#### **Real-time Performance Monitoring**
- **Live FPS Chart**: Centered performance chart showing frame rate in real-time
- **Interactive Performance Panel**: Hover over chart to see detailed metrics:
  - **Frame Rate**: Current, average, and min/max FPS with sparkline visualization
  - **Frame Timing**: Frame time, update time, and render time (Phaser plugin integration)
  - **Memory Usage**: JavaScript heap usage with optional texture memory tracking
  - **Rendering Stats**: Draw calls, game objects, physics bodies, and active tweens
  - **Performance Health**: Jank event tracking for performance bottlenecks
- **Tier-based Monitoring**: Automatic detection of available performance data sources
- **Mobile-optimized**: Chart scales appropriately for different screen sizes

#### **Enhanced Settings Panel**
- **Device-specific Settings**: Canvas glow setting only appears on supported devices
- **Canvas Scaling Toggle**: Control whether game scales to fill screen or shows at native size
- **Background Pattern Toggle**: Show/hide decorative background texture
- **Consistent Design**: All settings use unified green color theme matching SDK integration status

#### **Integrated Build System**
- **One-Click Building**: Build your game instantly without leaving the dashboard

#### **Responsive Design Improvements**
- **Mobile-first Layout**: Optimized toolbar spacing and button sizing for touch interfaces
- **Intelligent Canvas Sizing**: "Actual size" mode respects screen boundaries while maintaining aspect ratio
- **Natural Content Flow**: Flexbox layout allows each section to occupy space as needed
- **Consistent Spacing**: Unified padding and margin system across all screen sizes

### Console Logging
The development environment provides clean, focused logging:
```
[SDK Event] ready
[SDK Event] game_over {"score":3}
[SDK Event] play_again 
[SDK Event] toggle_mute {"isMuted":true}
```

## Customizing Your Game

### Remove the Demo Content
When you're ready to build your actual game, ask an AI assistant (like Claude Code):

> "Please remove the demo code and give me a blank game scene to start building my game."

### Project Structure Explained
```
your-game/
├── .is_fresh              # Safety marker (removed after setup)
├── index.html             # Main HTML file - loads Phaser and Remix SDK
├── package.json           # Project info and available commands
├── .remix/                # Development environment (hidden directory)
│   ├── overlay.ts         # Development overlay entry point
│   ├── game.ts           # Development game entry point with SDK mock
│   ├── RemixDevOverlay.ts # Professional development UI with performance monitoring
│   ├── PerformanceMonitor.ts # Real-time performance tracking system
│   ├── performance-plugin.js # Phaser plugin for detailed game metrics
│   ├── dev-settings.ts   # Settings panel with device-specific options
│   ├── RemixSDKMock.ts   # SDK mock for testing
│   ├── remix-dev-overlay.css # Development UI styles
│   └── remix-game-styles.css # Game frame styles
├── src/                   # Your game code goes here
│   ├── main.ts           # Game entry point - creates Phaser game
│   ├── config/
│   │   └── GameSettings.ts # Game settings (720x1080, debug mode, etc.)
│   ├── scenes/
│   │   └── GameScene.ts   # Main game scene (click-to-progress demo)
│   ├── utils/
│   │   └── RemixUtils.ts  # Remix platform integration
│   └── types.ts          # TypeScript type definitions
├── scripts/               # Build and development scripts
└── dist/                 # Built game files (created when you run build)
```

### Key Files to Understand:
- **`src/main.ts`**: Creates the Phaser game with your settings
- **`src/scenes/GameScene.ts`**: Where your game logic lives (currently 3-click demo)
- **`src/config/GameSettings.ts`**: Adjust canvas size (720x1080), debug mode, etc.
- **`index.html`**: Loads Phaser and Remix SDK, conditionally loads development environment
- **`.remix/`**: Development environment tooling — not included in production builds

## Available Commands

```bash
npm run remix-setup # Sets up fresh project
npm run dev         # Start development server (most common)
npm run build       # Build for production (creates dist/index.html)
npm run preview     # Preview the built game locally — good for checking build-specific errors such as missing assets
```

## Common Development Workflow

1. **Start Development**: `npm run dev`
2. **Edit Code**: Make changes in `src/` folder
3. **See Changes**: Browser refreshes automatically
4. **Test on Mobile**: Scan QR code with phone
5. **Build for Production**: `npm run build` when ready
6. **Deploy**: Copy contents of `dist/index.html` to Remix platform

## Troubleshooting

### Common Issues:

**"Command not found: npm"**
- Install Node.js from [nodejs.org](https://nodejs.org)
- Restart your terminal after installation

**"npm run remix-setup fails"**
- Make sure you're in the correct folder (should contain `package.json`)
- Check that the `.is_fresh` file exists (if missing, you may have already run setup)

**"Port 3000 is already in use"**
- Use `npm run dev:3001` or `npm run dev:any` for different ports
- Or stop other servers using port 3000

**"Game doesn't load on mobile"**
- Ensure your phone and computer are on the same Wi-Fi network
- Try refreshing the page or scanning the QR code again
- Check that no firewall is blocking the connection

**"TypeScript errors about Phaser"**
- Never import Phaser in your TypeScript files
- Phaser is loaded globally via CDN in `index.html`
- Remove any `import Phaser from 'phaser'` lines
- You can ask your LLM to resolve this for you

### Building for Production
```bash
npm run build
```
This creates `dist/index.html` - a single file containing your entire game ready for Remix deployment.

## Deployment to Remix

1. **Build**: Run `npm run build`
2. **Copy**: Open `dist/index.html` and copy all contents
3. **Paste**: Paste into Remix platform
4. **Test**: Verify everything works on the platform
5. **Publish**: Release your game to players

## What's Included

- **Phaser**: HTML5 game framework (loaded via CDN)
- **TypeScript**: Type-safe development with proper Phaser types
- **Vite**: Fast build tool and dev server with hot reload
- **Remix SDK**: Platform integration with comprehensive testing tools
- **Mobile optimization**: 2:3 aspect ratio for proper mini-app scaling
- **Professional Development Environment**:
  - **Advanced SDK Testing**: 2x2 grid status indicators with detailed hover panel
  - **Real-time Performance Monitoring**: Live FPS charts, memory tracking, and performance metrics
  - **Intelligent Settings Panel**: Device-specific options with consistent theming
  - **Responsive Design**: Mobile-optimized layout with intelligent canvas sizing
  - **Interactive Overlays**: Game over simulation and settings management
  - **Multi-tier Monitoring**: Automatic detection of available performance data sources

## Getting Help:

- Copy and paste any error output to your LLM.
- Join the [Remix Discord Server](https://discord.com/invite/a3bgdr4RC6) 

## License

MIT License - See LICENSE file for details
