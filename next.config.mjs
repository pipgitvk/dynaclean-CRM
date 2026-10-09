/** @type {import('next').NextConfig} */
const nextConfig = {
  // Inlined into the server runtime so remote MySQL always prefers TLS.
  // Override locally with DB_SSL=false in the environment *before* next boots
  // only works if this key is unset at config-eval time.
  env: {
    DB_SSL: process.env.DB_SLL ?? "true",
  },
  serverExternalPackages: ["face-api.js", "@tensorflow/tfjs", "node-cron"],
  logging: {
    incomingRequests: false,
  },
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
      // Serve company documents via catch-all API route
      {
        source: "/company_documents/:path*",
        destination: "/api/serve/:path*",
      },
    ];
  },
};

export default nextConfig;
