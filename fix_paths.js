const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

// Fix 10.1 invite path
content = content.replace('/api/v1/memberships/invitations', '/api/v1/memberships/invite');

// Fix 10.4 and 10.5 department path
content = content.replace(/\/api\/v1\/departments/g, '/api/v1/organizations/departments');

fs.writeFileSync(testFile, content);
console.log('Fixed paths');
