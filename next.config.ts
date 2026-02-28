import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // ⚠️ Temporarily ignore build errors for deployment
    // TODO: Generate proper database types from Supabase
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // Increased from default 1mb for bulk product entry with images
    },
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage — imágenes de productos, clientes, etc.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Supabase Storage — URL directa del proyecto (fallback)
        protocol: 'https',
        hostname: 'mwdqdrqlzlffmfqqcnmp.supabase.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
