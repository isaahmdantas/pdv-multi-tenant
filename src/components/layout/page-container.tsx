export function PageContainer({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-5xl space-y-6 ${className}`}>{children}</div>
  )
}