/**
 * Public Layout
 * 
 * Layout for public pages (login, etc.) without authentication
 */

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}
