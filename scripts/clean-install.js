#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning previous installations...');

// Remove node_modules and lock files
const removeDir = (dir) => {
  if (fs.existsSync(dir)) {
    console.log(`Removing ${dir}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const removeFile = (file) => {
  if (fs.existsSync(file)) {
    console.log(`Removing ${file}...`);
    fs.unlinkSync(file);
  }
};

removeDir('node_modules');
removeFile('package-lock.json');
removeFile('yarn.lock');

// Clear npm cache
console.log('Clearing npm cache...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
} catch (error) {
  console.warn('Warning: Failed to clear npm cache:', error.message);
}

console.log('📦 Installing dependencies with retry logic...');

const maxAttempts = 3;
let attempt = 1;

const installDependencies = () => {
  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install', '--no-audit', '--no-fund'], {
      stdio: 'inherit',
      shell: true
    });

    npm.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    npm.on('error', (error) => {
      reject(error);
    });
  });
};

const retryInstall = async () => {
  while (attempt <= maxAttempts) {
    try {
      console.log(`Attempt ${attempt} of ${maxAttempts}...`);
      await installDependencies();
      console.log('✅ Dependencies installed successfully!');
      return;
    } catch (error) {
      console.log(`❌ Installation failed on attempt ${attempt}:`, error.message);
      
      if (attempt < maxAttempts) {
        console.log('⏳ Waiting 10 seconds before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempt++;
      } else {
        console.log('💥 All installation attempts failed');
        process.exit(1);
      }
    }
  }
};

retryInstall().then(() => {
  console.log('🎉 Clean install completed!');
}).catch((error) => {
  console.error('💥 Clean install failed:', error.message);
  process.exit(1);
});












