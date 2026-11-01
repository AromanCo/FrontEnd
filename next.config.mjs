/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.AROMAN_TEST_NEXT_DIST_DIR || '.next',
};
export default nextConfig;
