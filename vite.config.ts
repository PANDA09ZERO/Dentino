import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Separa React y los iconos en archivos propios: la aplicación queda en un archivo pequeño y las librerías se guardan en caché entre versiones.
export default defineConfig({plugins:[react()],build:{rolldownOptions:{output:{codeSplitting:{groups:[{name:'react',test:/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,priority:20},{name:'iconos',test:/[\\/]node_modules[\\/]lucide-react[\\/]/,priority:10}]}}}},server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001','/uploads':'http://127.0.0.1:3001','/images':'http://127.0.0.1:3001'}}});
