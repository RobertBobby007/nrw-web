import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "giddrnlthbymuslaghzr.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ],
  },
};

export default nextConfig;
