/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@covenant/server', '@covenant/sidekick'],
  },
}

module.exports = nextConfig
