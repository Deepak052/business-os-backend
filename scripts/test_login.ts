

async function main() {
  try {
    const loginRes = await fetch('http://localhost:8000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@acme.com',
        password: 'Admin@1234'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    console.log('Login successful');

    const meRes = await fetch('http://localhost:8000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    
    console.log('Me Response:');
    console.log(JSON.stringify(meData.data, null, 2));

    const permsRes = await fetch('http://localhost:8000/api/v1/auth/permissions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const permsData = await permsRes.json();

    console.log('Permissions Response:');
    console.log(JSON.stringify(permsData.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
