'use client';

import { ThemeProvider } from '@/components/theme-provider';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
            <div className="light" data-theme="light">
                {children}
            </div>
        </ThemeProvider>
    );
}