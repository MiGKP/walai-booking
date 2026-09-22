const fs = require('fs');
const path = require('path');

function getTailwindSize(px) {
  if (px <= 12.9) return 'text-xs';
  if (px <= 14.9) return 'text-sm';
  if (px <= 17.9) return 'text-base';
  if (px <= 19.9) return 'text-lg';
  if (px <= 23.9) return 'text-xl';
  if (px <= 27.9) return 'text-2xl';
  if (px <= 31.9) return 'text-3xl';
  if (px <= 35.9) return 'text-4xl';
  if (px <= 47.9) return 'text-5xl';
  if (px <= 59.9) return 'text-6xl';
  if (px <= 71.9) return 'text-7xl';
  return 'text-8xl';
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Regex to match text-[Xpx] or text-[X.Ypx]
  const regex = /text-\[(\d+(\.\d+)?)px\]/g;
  
  content = content.replace(regex, (match, pxStr) => {
    const px = parseFloat(pxStr);
    return getTailwindSize(px);
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('Done!');
