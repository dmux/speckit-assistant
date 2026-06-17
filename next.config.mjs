/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // node-pty is a native addon and must not be bundled by webpack; load it from
  // node_modules at runtime on the server instead.
  serverExternalPackages: ['node-pty'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
