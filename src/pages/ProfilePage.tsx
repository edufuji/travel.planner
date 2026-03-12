import BottomNav from '@/components/BottomNav'

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center mb-4">
        <span className="text-3xl">👤</span>
      </div>
      <h1 className="text-xl font-extrabold text-foreground mb-2">Profile</h1>
      <p className="text-sm text-muted">Account features coming soon</p>
      <BottomNav />
    </div>
  )
}
