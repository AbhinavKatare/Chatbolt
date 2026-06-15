/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  images: {
    minimumCacheTTL: 60,
  },
  compiler: {
    removeConsole: {
      exclude: ['error'],
    },
  },
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
}

module.exports = nextConfig
