/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SENTINEL_API_URL: process.env.SENTINEL_API_URL ?? 'http://localhost:7379',
    STELLAR_NETWORK: process.env.STELLAR_NETWORK ?? 'testnet',
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // mqtt uses Node.js built-ins for TCP/TLS — stub them out in the browser.
      // The browser transport uses WebSocket only, so these are never called.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        readline: false,
      };
    }
    return config;
  },
};

export default nextConfig;
