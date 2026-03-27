const fs = require('fs');
const acorn = require('acorn');
const code = fs.readFileSync('static/script.js', 'utf8');
try {
  acorn.parse(code, { ecmaVersion: 2020 });
  console.log('No syntax errors');
} catch (e) {
  console.log('Syntax error:', e);
}
