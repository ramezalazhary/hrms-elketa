import http from 'http';

function makeRequest(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    console.log("1. Logging in as Admin...");
    let adminLogin = await makeRequest('/api/auth/login', 'POST', { email: 'admin@hr.local', password: 'admin123' });
    const adminToken = adminLogin.body.accessToken;
    console.log("Admin token obtained.");

    // Create a new employee with a random email
    const randomSuffix = Date.now().toString().slice(-6);
    const testEmail = `tester_${randomSuffix}@hr.local`;
    
    // For department/position we will fake it to an existing default one, or just strings if it accepts it based on our CRUD tests earlier
    console.log("2. Creating new Employee to trigger Auto-Provisioning...");
    // Let's create a Department to be safe
    const deptResp = await makeRequest('/api/departments', 'POST', { name: 'Auto Dept ' + randomSuffix }, adminToken);
    const deptId = deptResp.body.id || deptResp.body._id;

    // Create a Position
    const posResp = await makeRequest('/api/positions', 'POST', { title: 'Auto Pos', departmentId: deptId }, adminToken);
    const posId = posResp.body.position ? (posResp.body.position.id || posResp.body.position._id) : (posResp.body.id || posResp.body._id);

    const empPayload = {
      fullName: "Test Provisioner",
      email: testEmail,
      department: deptId,
      position: posId,
    };
    
    let createEmp = await makeRequest('/api/employees', 'POST', empPayload, adminToken);
    console.log("Employee Created Status:", createEmp.status);
    console.log("userProvisioned flag:", createEmp.body.userProvisioned);
    console.log("defaultPassword:", createEmp.body.defaultPassword);
    
    if (!createEmp.body.userProvisioned) throw new Error("Auto-Provisioning Failed!");

    console.log("\n3. Testing Login for newly auto-provisioned User...");
    let newLogin = await makeRequest('/api/auth/login', 'POST', { email: testEmail, password: 'Welcome123!' });
    console.log("New User Login Status:", newLogin.status);
    console.log("requirePasswordChange Flag:", newLogin.body.user?.requirePasswordChange);
    
    if (newLogin.status !== 200) throw new Error("Failed to log in as the newly provisioned user!");
    if (!newLogin.body.user.requirePasswordChange) throw new Error("requirePasswordChange was false, should be true!");

    console.log("\n4. Testing Admin Reset Password API...");
    // We pass targetEmail = testEmail and newPassword = 'ForcedPassword123!'
    let resetReq = await makeRequest('/api/auth/reset-password', 'POST', {
      targetEmail: testEmail,
      newPassword: 'ForcedPassword123!'
    }, adminToken);
    console.log("Admin Reset Password Status:", resetReq.status);
    console.log("Admin Reset Password Response:", resetReq.body);

    if (resetReq.status !== 200) throw new Error("Admin failed to reset the user password.");

    console.log("\n5. Verifying Admin Reset by logging in again...");
    let checkReset = await makeRequest('/api/auth/login', 'POST', { email: testEmail, password: 'ForcedPassword123!' });
    console.log("Reset User Login Status:", checkReset.status);
    
    if (checkReset.status !== 200) throw new Error("Failed to log in with Admin-reset password!");
    console.log("✅ All Provisioning and Reset APIs fully working!");
    
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
})();
