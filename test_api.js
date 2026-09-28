const http = require('http');

const data = JSON.stringify({
  countryId: "2",
  establishmentId: "2",
  statutoryName: "CPF",
  baseComponentId: "ctc",
  rules: [
    { id: "cpf-rule-1", minAge: 0, maxAge: 55, employeePercentage: 20, employerPercentage: 17 }
  ],
  epsPercentage: 0,
  epfPercentage: 0
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/ca-statutory-configs',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
