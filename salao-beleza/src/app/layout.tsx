// src/app/layout.tsx
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import React from "react";
import { Toaster } from 'sonner';
import { SpeedInsights } from '@vercel/speed-insights/next';

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Studio Anny Martins | Agendamentos",
  description: "Agende serviços de beleza no Studio Anny Martins e acompanhe seus atendimentos.",
};

// Adicionando a tipagem para a prop 'children'
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={poppins.className}>
        <Toaster richColors position="top-right" />
        {children}
        <SpeedInsights/>
        </body>
    </html>
  );
}