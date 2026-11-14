import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SongBridge · 网易云到 Apple Music",
  description: "导出网易云歌单，核对歌曲版本，再迁移到 Apple Music。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
