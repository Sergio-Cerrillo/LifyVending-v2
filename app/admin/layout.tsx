'use client';

import { AuthProvider } from '@/contexts/auth-context';
import { DataProvider } from '@/contexts/data-context';
import { AdminLayout } from '@/components/admin/admin-layout';
import { DevUserSwitcher } from '@/components/admin/dev-user-switcher';
import { ThemeProvider } from '@/components/theme-provider';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
      <div className="light" data-theme="light">
        <AuthProvider>
          <DataProvider>
            <AdminLayout>{children}</AdminLayout>
            <DevUserSwitcher />
          </DataProvider>
        </AuthProvider>
      </div>
    </ThemeProvider>
  );
}
