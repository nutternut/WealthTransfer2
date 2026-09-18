import type { NextConfig } from "next";
import path from "path";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
  "https://api.kobi-ai.com";

const nextConfig: NextConfig = {
  // ให้เปิดผ่าน LAN IP / ngrok ในโหมด dev ได้
  allowedDevOrigins: ["192.168.0.157", "*.ngrok-free.app", "*.ngrok-free.dev"],
  turbopack: {
    root: path.join(__dirname),
  },
  // Proxy Supabase ผ่าน same-origin เพื่อเลี่ยง CORS จากเบราว์เซอร์
  async rewrites() {
    return [
      {
        source: "/supabase/:path*",
        destination: `${supabaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
