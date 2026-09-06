const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let contentToAppend = `
  describe('10.3 RBAC Privilege Escalation', () => {
    it('Admin assigning permission they do not possess -> 403', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({
          name: 'Escalated Role',
          permissions: ['manage:platform']
        });
      expect(res.status).toBe(403);
    });
  });

  describe('10.4 Subscription-State Attacks', () => {
    it('Mutations fail when subscription is EXPIRED', async () => {
      // Setup: change org subscription to EXPIRED
      await prisma.subscription.updateMany({
        where: { organizationId: orgAId },
        data: { status: 'EXPIRED' }
      });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ name: 'Should Fail Dept' });
      
      expect(res.status).toBe(403);

      // Restore active state
      await prisma.subscription.updateMany({
        where: { organizationId: orgAId },
        data: { status: 'ACTIVE' }
      });
    });
  });

  describe('10.5 Quota Boundary Attacks', () => {
    it('Exceeding max_departments fails with QUOTA_EXCEEDED', async () => {
      // quota is 5, we already have Dept A (1). We will create 4 more to hit 5, then 6th should fail.
      await prisma.department.createMany({
        data: [
          { name: 'Dept 2', organizationId: orgAId },
          { name: 'Dept 3', organizationId: orgAId },
          { name: 'Dept 4', organizationId: orgAId },
          { name: 'Dept 5', organizationId: orgAId }
        ]
      });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ name: 'Dept 6' });
      
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('QUOTA_EXCEEDED');
    });
  });
`;

let content = fs.readFileSync(testFile, 'utf8');

// Also fix the `/api/v1/organizations/invitations` to `/api/v1/memberships/invitations`
content = content.replace('/api/v1/organizations/invitations', '/api/v1/memberships/invitations');
// Also change the expected status codes to 403 or 404
content = content.replace('expect([200, 201]).toContain(res.status);', 'expect([200, 201]).toContain(res.status);'); 

content = content.replace(/}\);\s*$/, contentToAppend + '\n});\n');
fs.writeFileSync(testFile, content);
console.log('Appended 10.3 to 10.5!');
