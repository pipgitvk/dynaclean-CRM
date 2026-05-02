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
      // Serve uploaded files via catch-all API route (query-string rewrites do not
      // reliably pass :path* into ?path=, which caused {"error":"File path required"}).
      {
        source: "/uploads/:path*",
        destination: "/api/serve/:path*",
      },
    ];
  },
};

export default nextConfig;
