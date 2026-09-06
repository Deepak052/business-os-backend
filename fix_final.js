const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

// Fix 10.8 Role & Permission Isolation
const target108 = `
      const res = await request(app)
        .patch(\`/api/v1/memberships/\${membership!.id}\`)
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ roleIds: [] });
`;
const replace108 = `
      const res = await request(app)
        .patch(\`/api/v1/memberships/\${membership!.id}\`)
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ roleId: roleAId });
`;
content = content.replace(target108.trim(), replace108.trim());

// Fix 10.15 State Machine Bypass token hashing
const target1015 = `
          roleId: roleAId,
          token: 'some-random-token',
          status: 'revoked',
`;
const replace1015 = `
          roleId: roleAId,
          token: crypto.createHash('sha256').update('some-random-token').digest('hex'),
          status: 'revoked',
`;
content = content.replace(target1015.trim(), replace1015.trim());

fs.writeFileSync(testFile, content);
console.log('Final fixes applied!');
