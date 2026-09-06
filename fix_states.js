const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

// Fix 10.4 subscription state case
content = content.replace("status: 'EXPIRED'", "status: 'expired'");
content = content.replace("status: 'ACTIVE'", "status: 'active'");

fs.writeFileSync(testFile, content);
console.log('Fixed subscription states');
