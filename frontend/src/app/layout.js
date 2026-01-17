import './globals.css';

export const metadata = {
  title: 'D2C Donation Platform',
  description: 'Admin dashboard'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
