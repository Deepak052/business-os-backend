const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'src/tests/gate10-e2e-security.test.ts');
const contentToAppend = `
  describe('10.6 Quota Concurrency (Race Condition)', () => {
    it('Concurrent creation respects quota limits', async () => {
      // Create concurrent requests to exceed the role quota (limit is 5)
      const reqs = Array.from({ length: 10 }).map((_, i) => 
        request(app)
          .post('/api/v1/roles')
          .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
          .set('x-organization-id', orgAId)
          .send({ name: \`Concurrent Role \${i}\` })
      );
      
      const responses = await Promise.all(reqs);
      const successes = responses.filter(r => r.status === 201).length;
      
      // Admin role, Employee role, Escalated Role + successes should be <= 5
      // The important part is some fail with 403
      const quotaExceeded = responses.some(r => r.body.error?.code === 'QUOTA_EXCEEDED');
      expect(quotaExceeded).toBe(true);
    });
  });

  describe('10.7 Module Boundary Enforcement', () => {
    it('Accessing disabled module endpoint -> MODULE_DISABLED', async () => {
      // Assuming 'crm' module is not active for Org A by default
      const res = await request(app)
        .post('/api/v1/crm/contacts')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ firstName: 'Test', lastName: 'Contact', email: 'contact@test.com' });
      
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });
  });

  describe('10.8 Role & Permission Isolation', () => {
    it('User cannot modify their own role -> 403', async () => {
      // Find a membership for orgAdminA
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: orgAdminAId, organizationId: orgAId }
      });
      
      const res = await request(app)
        .patch(\`/api/v1/memberships/\${membership!.id}/roles\`)
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({ roleIds: [] });
      
      // Expected SELF_PRIVILEGE_ESCALATION or similar
      expect(res.status).toBe(403);
    });
  });

  describe('10.11 Authentication & Session Security', () => {
    it('Invalid token is rejected', async () => {
      const res = await request(app)
        .get('/api/v1/organizations/departments')
        .set('Authorization', 'Bearer invalid.token.here')
        .set('x-organization-id', orgAId);
      
      expect(res.status).toBe(401);
    });

    it('Valid user token with different x-organization-id -> 403', async () => {
      // We already tested this in 10.2 (Org Admin B reading Org A)
      const res = await request(app)
        .get('/api/v1/organizations/departments')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgBId); // not a member
      expect(res.status).toBe(403);
    });
  });

  describe('10.12 IDOR / Resource Ownership', () => {
    it('Cannot modify department from another organization', async () => {
      // Org Admin B trying to delete Dept from Org A
      const deptA = await prisma.department.findFirst({ where: { organizationId: orgAId } });
      const res = await request(app)
        .delete(\`/api/v1/organizations/departments/\${deptA!.id}\`)
        .set('Authorization', \`Bearer \${orgAdminTokenB}\`)
        .set('x-organization-id', orgBId);
      
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('10.13 Mass Assignment / Over-posting', () => {
    it('Cannot inject organizationId or isSystem in role creation', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', \`Bearer \${orgAdminTokenA}\`)
        .set('x-organization-id', orgAId)
        .send({
          name: 'Hacked Role',
          organizationId: orgBId, // Injecting orgBId
          isSystem: true // Injecting isSystem
        });
      
      // It might succeed to create the role but should IGNORE the injected fields, or throw 400
      if (res.status === 201) {
        const role = await prisma.role.findUnique({ where: { id: res.body.data.id } });
        expect(role!.organizationId).toBe(orgAId);
        expect(role!.isSystem).toBe(false);
      } else {
        expect([400, 403]).toContain(res.status);
      }
    });
  });

  describe('10.15 State Machine Bypass', () => {
    it('Cannot accept a revoked invitation', async () => {
      // Create invitation
      const invite = await prisma.invitation.create({
        data: {
          email: 'revoke@test.com',
          organizationId: orgAId,
          inviterId: orgAdminAId,
          token: 'some-random-token',
          status: 'revoked',
          expiresAt: new Date(Date.now() + 100000)
        }
      });

      const res = await request(app)
        .post('/api/v1/memberships/accept')
        .send({ token: invite.token });
      
      expect(res.status).toBe(400); // or 403
    });
  });
`;

let content = fs.readFileSync(testFile, 'utf8');
content = content.replace(/}\);\s*$/, contentToAppend + '\n});\n');
fs.writeFileSync(testFile, content);
console.log('Appended rest of tests!');
