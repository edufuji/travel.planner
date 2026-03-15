import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          role="status"
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
