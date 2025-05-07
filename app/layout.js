import './globals.css';

export const metadata = {
  title: 'Acta Generator',
  description: 'Generate equipment actas easily',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}