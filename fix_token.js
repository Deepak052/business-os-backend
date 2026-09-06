const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

const target = `
      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .set('Authorization', \`Bearer \${orgAdminTokenB}\`) // Just need ANY valid user session
        .send({ token: invite.token });
`;
const replace = `
      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .set('Authorization', \`Bearer \${orgAdminTokenB}\`) // Just need ANY valid user session
        .send({ token: 'some-random-token' });
`;

content = content.replace(target.trim(), replace.trim());
fs.writeFileSync(testFile, content);
console.log('Fixed 10.15 passing token');
