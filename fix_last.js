const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

// Fix 10.8 URL
content = content.replace('.patch(`/api/v1/memberships/${membership!.id}/roles`)', '.patch(`/api/v1/memberships/${membership!.id}`)');

// Fix 10.15 Add auth token
const target1015 = `
      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .send({ token: invite.token });
`;

const replace1015 = `
      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .set('Authorization', \`Bearer \${orgAdminTokenB}\`) // Just need ANY valid user session
        .send({ token: invite.token });
`;

content = content.replace(target1015, replace1015);

fs.writeFileSync(testFile, content);
console.log('Fixed 10.8 and 10.15 issues');
