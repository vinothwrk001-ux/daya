const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'validators');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let updated = false;

    // ../../models -> ../models
    if (content.includes('../../')) {
      content = content.replace(/\.\.\/\.\.\//g, '../');
      updated = true;
    }

    // require("../something") -> require("./something") where it was accessing sibling files in utils/validators
    // But wait! If it's require("../utils/something"), changing it to require("./utils/something") would break.
    // If it was require("../utils/AppError"), and it moved from src/utils/validators to src/validators
    // Then it was require("../../utils/AppError") -> which became require("../utils/AppError") via the rule above!
    // So if it was require("../something") it means it was going up ONE level from utils/validators to utils.
    // E.g., require("../AppError") -> this is src/utils/AppError.
    // Since it's now in src/validators, to reach src/utils/AppError, it should be require("../utils/AppError").
    // Let's NOT blanket replace require("../" to require("./".
    // I will log the content instead.
    
    if (updated) {
      fs.writeFileSync(fullPath, content);
      console.log('Updated ' + file);
    }
  }
});
