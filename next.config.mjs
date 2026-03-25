/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["face-api.js", "@tensorflow/tfjs"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "dynacleanindustries.com",
      },
    ],
  },
  async rewrites() {
    return [
      // Handle common misspellings/pluralizations for expense attachments
      {
        source: "/expenses_attachments/:path*",
        destination: "/expense_attachments/:path*",
      },
      {
        source: "/expenses_atachments/:path*",
        destination: "/expense_attachments/:path*",
      },
      {
        source: "/expense_atachments/:path*",
        destination: "/expense_attachments/:path*",
      },
      {
        source: "/expenses-attachments/:path*",
        destination: "/expense_attachments/:path*",
      },
    ];
  },
};

export default nextConfig;
