// 소스 모듈을 한 장짜리 HTML로 묶는다. 실행: node build.js  →  dist/index.html
const fs = require('fs'), path = require('path'), r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const ui = r('ui.js').replace('/*@@DOMESTIC_UI@@*/', () => r('ui_domestic.js'));
const html = r('index.template.html').replace('/*@@CSS@@*/', () => r('styles.css')).replace('/*@@BALANCE@@*/', () => r('balance.js')).replace('/*@@SIM@@*/', () => r('sim.js')).replace('/*@@DOMESTIC@@*/', () => r('domestic.js')).replace('/*@@UI@@*/', () => ui);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + 'KB');
