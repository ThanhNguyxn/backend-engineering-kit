#!/usr/bin/env node
/**
 * count-stats.js
 * 
 * Script to count patterns, checklists, and adapters dynamically.
 * Used to keep counts accurate across documentation.
 * 
 * Usage:
 *   node scripts/count-stats.js
 *   node scripts/count-stats.js --json
 *   node scripts/count-stats.js --markdown
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function countAdapterTemplates() {
  const adaptersDir = path.join(ROOT, 'adapters', 'templates');
  const files = fs.readdirSync(adaptersDir).filter(f => f.endsWith('.md'));
  // Exclude base.md as it's a meta template
  return files.filter(f => f !== 'base.md').length;
}

function countFromRegistry() {
  const registryPath = path.join(ROOT, 'templates', 'registry.yaml');
  const content = fs.readFileSync(registryPath, 'utf8');
  
  // Simple YAML parsing without dependencies
  // Count lines starting with "  - id:" for different sections
  const lines = content.split('\n');
  
  let inSection = '';
  let projectTemplates = 0;
  let patterns = 0;
  let checklists = 0;
  let adapters = 0;
  
  for (const line of lines) {
    // Detect section headers
    if (line.startsWith('templates:')) inSection = 'templates';
    else if (line.startsWith('adapters:')) inSection = 'adapters';
    else if (line.startsWith('knowledge:')) inSection = 'knowledge';
    
    // Count items
    if (line.match(/^  - id:/)) {
      if (inSection === 'templates') projectTemplates++;
      else if (inSection === 'adapters') adapters++;
      else if (inSection === 'knowledge') {
        // Look ahead to find type
        const idx = lines.indexOf(line);
        for (let i = idx; i < idx + 10 && i < lines.length; i++) {
          if (lines[i].includes('type: pattern')) { patterns++; break; }
          if (lines[i].includes('type: checklist')) { checklists++; break; }
        }
      }
    }
  }
  
  return {
    projectTemplates,
    patterns,
    checklists,
    adaptersInRegistry: adapters
  };
}

function countKnowledgeFiles() {
  // Count actual files in .shared/production-backend-kit directory
  const baseDir = path.join(ROOT, '.shared', 'production-backend-kit');
  const patternsDir = path.join(baseDir, 'patterns');
  const checklistsDir = path.join(baseDir, 'checklists');
  
  let patternFiles = 0;
  let checklistFiles = 0;
  
  function countMdFiles(dir) {
    let count = 0;
    if (!fs.existsSync(dir)) return 0;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        count += countMdFiles(itemPath);
      } else if (item.endsWith('.md') && !item.toLowerCase().includes('readme')) {
        count++;
      }
    }
    return count;
  }
  
  patternFiles = countMdFiles(patternsDir);
  checklistFiles = countMdFiles(checklistsDir);
  
  return { patternFiles, checklistFiles };
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const markdownOutput = args.includes('--markdown');
  
  const adapterCount = countAdapterTemplates();
  const registryStats = countFromRegistry();
  const fileStats = countKnowledgeFiles();
  
  const stats = {
    adapters: adapterCount,
    projectTemplates: registryStats.projectTemplates,
    patternsInRegistry: registryStats.patterns,
    patternFiles: fileStats.patternFiles,
    checklistsInRegistry: registryStats.checklists,
    checklistFiles: fileStats.checklistFiles,
    adaptersInRegistry: registryStats.adaptersInRegistry,
    // Use file count for display (more accurate)
    patterns: Math.max(registryStats.patterns, fileStats.patternFiles),
    checklists: Math.max(registryStats.checklists, fileStats.checklistFiles)
  };
  
  if (jsonOutput) {
    console.log(JSON.stringify(stats, null, 2));
  } else if (markdownOutput) {
    console.log(`## Backend Engineering Kit Stats\n`);
    console.log(`| Category | Count |`);
    console.log(`|----------|-------|`);
    console.log(`| AI Adapter Templates | ${stats.adapters} |`);
    console.log(`| Project Templates | ${stats.projectTemplates} |`);
    console.log(`| Patterns | ${stats.patterns}+ |`);
    console.log(`| Checklists | ${stats.checklists} |`);
  } else {
    console.log(`\n📊 Backend Engineering Kit Statistics\n`);
    console.log(`   AI Adapter Templates: ${stats.adapters}`);
    console.log(`   Project Templates:    ${stats.projectTemplates}`);
    console.log(`   Patterns:             ${stats.patterns}+`);
    console.log(`   Checklists:           ${stats.checklists}\n`);
    
    if (stats.adapters !== stats.adaptersInRegistry) {
      console.log(`   ⚠️  Adapter files (${stats.adapters}) != registry entries (${stats.adaptersInRegistry})`);
    }
    if (stats.patternFiles !== stats.patternsInRegistry) {
      console.log(`   ⚠️  Pattern files (${stats.patternFiles}) != registry entries (${stats.patternsInRegistry})`);
    }
    if (stats.checklistFiles !== stats.checklistsInRegistry) {
      console.log(`   ⚠️  Checklist files (${stats.checklistFiles}) != registry entries (${stats.checklistsInRegistry})`);
    }
  }
}

main();
