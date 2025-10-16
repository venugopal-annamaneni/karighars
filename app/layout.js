import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'KG Interiors ERP',
  description: 'Interior Design Project Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
