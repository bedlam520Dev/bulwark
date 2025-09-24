#!/usr/bin/env node

import { execSync } from 'child_process'
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline/promises'

// Safety check: verify this is a fresh template
if (!existsSync('.remix/.setup_required')) {
  process.exit(1)
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

const proceed = await rl.question('Would you like to proceed with setup? (Y/n): ')
if (proceed.toLowerCase() === 'n' || proceed.toLowerCase() === 'no') {
  rl.close()
  process.exit(0)
}

// Detect package manager from npm_config_user_agent
const userAgent = process.env.npm_config_user_agent || ''
let packageManager = 'npm'

if (userAgent.includes('yarn')) {
  packageManager = 'yarn'
} else if (userAgent.includes('pnpm')) {
  packageManager = 'pnpm'
} else if (userAgent.includes('bun')) {
  packageManager = 'bun'
}


// Prompt for game name
let gameName = ''
while (!gameName.trim()) {
  gameName = await rl.question('Enter your game name: ')
  if (!gameName.trim()) {
    // Game name cannot be empty
  }
}

rl.close()

// Create sanitized version for package.json
const packageName = gameName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')

// Replace GAME_NAME in all files

const filesToUpdate = [
  { path: 'index.html', search: /GAME_NAME/g, replace: gameName },
  { path: 'src/config/GameSettings.ts', search: /GAME_NAME/g, replace: gameName },
  { path: 'scripts/build.js', search: /GAME_NAME/g, replace: gameName }
]

filesToUpdate.forEach(({ path, search, replace }) => {
  try {
    const content = readFileSync(path, 'utf8')
    const updatedContent = content.replace(search, replace)
    writeFileSync(path, updatedContent)
    // Updated file
  } catch (error) {
    // Failed to update file
  }
})

// Handle package.json separately with both name and description
try {
  const packageJsonContent = readFileSync('package.json', 'utf8')
  const packageJson = JSON.parse(packageJsonContent)
  
  // Update name with hyphenated version
  packageJson.name = packageName
  
  // Update description with original game name
  packageJson.description = `${gameName} game for Remix platform`
  
  writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n')
  // Updated package.json
} catch (error) {
  // Failed to update package.json
}

// Remove existing .git directory
const gitDir = join(process.cwd(), '.git')
if (existsSync(gitDir)) {
  rmSync(gitDir, { recursive: true, force: true })
}

// Remove the fresh template marker
if (existsSync('.remix/.setup_required')) {
  rmSync('.remix/.setup_required')
}

// Remove the template LICENSE file
if (existsSync('LICENSE')) {
  rmSync('LICENSE')
}

// Install dependencies
try {
  const installCommand = packageManager === 'yarn' ? 'yarn install' : 
                        packageManager === 'pnpm' ? 'pnpm install' :
                        packageManager === 'bun' ? 'bun install' : 'npm install'
  
  execSync(installCommand, { stdio: 'inherit' })
} catch (error) {
  process.exit(1)
}

// Initialize new git repository
try {
  execSync('git init', { stdio: 'inherit' })
  execSync('git add .', { stdio: 'inherit' })
  execSync('git commit -m "initial commit"', { stdio: 'inherit' })
} catch (error) {
  process.exit(1)
}

