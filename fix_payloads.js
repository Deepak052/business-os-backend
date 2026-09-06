const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
let content = fs.readFileSync(testFile, 'utf8');

// Fix 10.1 invite: create a role first and use it
const inviteTarget = `
    it('Org Admin A can invite an employee successfully', async () => {
      const res = await request(app)
        .post('/api/v1/memberships/invite')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({
          email: 'employeeA@test.com',
          roleId: null // or some valid role ID
        });
      
      // Usually 201 or 200, assume 201
      expect([200, 201]).toContain(res.status);
    });
`;

const inviteReplacement = `
    it('Org Admin A can invite an employee successfully', async () => {
      const role = await prisma.role.create({
        data: { name: 'Employee Role', organizationId: orgAId, isSystem: false }
      });
      const res = await request(app)
        .post('/api/v1/memberships/invite')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({
          email: 'employeeA@test.com',
          roleId: role.id
        });
      
      expect([200, 201]).toContain(res.status);
    });
`;

content = content.replace(inviteTarget.trim(), inviteReplacement.trim());

// Fix 10.3 RBAC Privilege Escalation
const rbacTarget = `
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
`;

const rbacReplacement = `
  describe('10.3 RBAC Privilege Escalation', () => {
    it('Admin assigning permission they do not possess -> 403', async () => {
      // Create a platform permission that is NOT delegatable
      const platPerm = await prisma.permission.create({
        data: { action: 'manage:platform', resource: 'platform', isDelegatable: false, description: 'Platform' }
      });
      
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({
          name: 'Escalated Role',
          permissions: [platPerm.id]
        });
      expect(res.status).toBe(403);
    });
  });
`;

content = content.replace(rbacTarget.trim(), rbacReplacement.trim());

fs.writeFileSync(testFile, content);
console.log('Fixed tests for 10.1 and 10.3');
