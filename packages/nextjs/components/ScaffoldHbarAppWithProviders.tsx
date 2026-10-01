"use client";

import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";

export const ScaffoldHbarAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <ProgressBar height="3px" color="#2299dd" />
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="relative flex flex-col flex-1">{children}</main>
        <Footer />
      </div>
    </>
  );
};
