import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // สร้าง .next/standalone (server.js + node_modules เท่าที่จำเป็น) สำหรับ Docker image ขนาดเล็ก
  output: "standalone",
};

export default nextConfig;

