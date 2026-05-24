import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      // Permite hasta 10MB en server actions con uploads de imágenes; sharp
      // recomprime después a WebP, así que el archivo en disco es bastante
      // más pequeño. Validación dura de 5MB pre-procesado en lib/storage.ts.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
