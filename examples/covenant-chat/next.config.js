/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['drizzle-orm'],
  },
};

module.exports = nextConfig;
