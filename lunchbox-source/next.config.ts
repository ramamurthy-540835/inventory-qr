import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [{ source: "/grocery-api/:path*", destination: "https://nelture-grocery-foovqasysa-el.a.run.app/:path*" }];
  },
};

export default withSerwist(nextConfig);
