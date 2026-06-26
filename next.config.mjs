/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer", "puppeteer-core"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "@sparticuz/chromium", "puppeteer", "puppeteer-core"];
    }

    return config;
  },
};

export default nextConfig;
