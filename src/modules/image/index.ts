import { defineAsyncComponent } from 'vue'
import type { PreviewModule } from '../types'
export default { id: 'image', extensions: ["png","jpg","jpeg","webp","gif","bmp","svg"], component: defineAsyncComponent(() => import('./index.vue')) } satisfies PreviewModule
