/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deja publicar la página aunque se encuentren algunos errores en el código.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Muestra las imágenes tal como se reciben, sin hacerles cambios.
  images: {
    unoptimized: true,
  },
  async headers() {
    // Añade reglas para ayudar a proteger la página mientras se usa en internet.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

export default nextConfig
