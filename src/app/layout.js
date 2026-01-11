import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast"; // ✅ Import toast provider
import NextTopLoader from "nextjs-toploader";
import { UserProvider } from "@/context/UserContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CRM | Dynaclean",
  description: "Manage your customers and leads efficiently",
  icons: {
    icon: [{ url: '/dynaclean_logo.png', type: 'image/png' }],
    apple: [{ url: '/dynaclean_logo.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>
          <NextTopLoader color="#16a34a" height={3} showSpinner={false} crawlSpeed={200} />
          {/* ✅ Global toast handler */}
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
