import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";
import { fontDisplay } from "@/lib/fonts";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontDisplay.variable} flex min-h-dvh flex-col`}>
      <MarketingNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
