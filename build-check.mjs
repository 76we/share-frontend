// build-check.mjs —— 调用 Vite API 执行生产构建（等效 npm run build）
import { build } from 'vite'

await build({
  root: 'D:/code/share-frontend',
  configFile: 'D:/code/share-frontend/vite.config.js',
  logLevel: 'info',
})
console.log('BUILD OK')
