'use client';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="light" data-theme="light">
            {children}
        </div>
    );
}
