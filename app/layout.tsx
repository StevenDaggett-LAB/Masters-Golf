import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="logo-wrap">
            <img src="/logo.png" alt="Golf Pool Logo" className="site-logo" />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}