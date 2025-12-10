/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  basePath: '/LifyVending',
  assetPrefix: '/LifyVending/',
  trailingSlash: true,
}

export default nextConfig
