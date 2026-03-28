import http from 'http';

const req = http.request('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const token = JSON.parse(data).accessToken;
    const req2 = http.request('http://localhost:5000/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, (res2) => {
      let data2 = '';
      res2.on('data', d => data2 += d);
      res2.on('end', () => {
        const deptId = JSON.parse(data2).id || JSON.parse(data2)._id;
        
        const req3 = http.request('http://localhost:5000/api/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        }, (res3) => {
          let data3 = '';
          res3.on('data', d => data3 += d);
          res3.on('end', () => {
            const posResp = JSON.parse(data3);
            console.log("POST /positions response:", posResp);
            const posId = posResp.position ? (posResp.position.id || posResp.position._id) : (posResp.id || posResp._id);
            
            console.log('Got Pos ID:', posId);
            
            const req4 = http.request(`http://localhost:5000/api/positions/${posId}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            }, (res4) => {
              let data4 = '';
              res4.on('data', d => data4 += d);
              res4.on('end', () => {
                console.log('Position GET Response:', res4.statusCode, data4);
              });
            });
            req4.end();
            
          });
        });
        req3.write(JSON.stringify({ title: 'Test Pos ' + Date.now(), departmentId: deptId }));
        req3.end();
      });
    });
    req2.write(JSON.stringify({ name: 'Test Dept ' + Date.now(), head: 'admin@hr.local' }));
    req2.end();
  });
});
req.write(JSON.stringify({ email: 'admin@hr.local', password: 'admin123' }));
req.end();
