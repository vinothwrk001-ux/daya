const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('../utils/validators/')) {
        content = content.replace(/\.\.\/utils\/validators\//g, '../validators/');
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + fullPath);
      } else if (content.includes('../../utils/validators/')) {
        content = content.replace(/\.\.\/\.\.\/utils\/validators\//g, '../../validators/');
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + fullPath);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'src', 'routes'));
replaceInDir(path.join(__dirname, 'src', 'services'));
