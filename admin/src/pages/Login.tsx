import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور')
      return
    }

    setIsLoading(true)
    try {
      await login(email, password)
      toast.success('مرحباً بك في لوحة التحكم')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const message = err?.response?.data?.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 relative overflow-hidden" dir="rtl">
      {/* Faint giant watermark */}
      <span
        aria-hidden
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 font-display text-[12rem] leading-none text-transparent select-none pointer-events-none whitespace-nowrap"
        style={{ WebkitTextStroke: '1px rgba(233, 207, 125, 0.07)' }}
      >
        التلغراف
      </span>

      <div className="w-full max-w-md relative animate-rise">
        {/* Masthead */}
        <div className="text-center mb-8">
          <h1 className="font-display text-6xl gold-foil leading-tight">التلغراف</h1>
          <div className="morse-line morse-line--subtle morse-line--animated max-w-[180px] mx-auto mt-4" />
          <p className="text-gray-400 mt-3 text-sm tracking-wide">لوحة التحكم والإدارة</p>
        </div>

        {/* Card */}
        <div className="bg-surface dark:bg-gray-800 rounded-md shadow-card-hover border border-gold-900/30 p-8">
          <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@altilgraf.com"
                className="w-full px-4 py-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500 transition-colors"
                required
                autoComplete="email"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500 transition-colors pl-11"
                  required
                  autoComplete="current-password"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold-600 dark:hover:text-gold-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-left">
              <button
                type="button"
                className="text-sm text-gold-700 hover:text-gold-600 dark:text-gold-400 hover:underline transition-colors"
                onClick={() => toast('يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور', { icon: 'ℹ️' })}
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="gold"
              size="lg"
              isLoading={isLoading}
              className="w-full btn-sheen"
            >
              تسجيل الدخول
            </Button>
          </form>
        </div>

        {/* Telegraph wire carrying a signal */}
        <div className="wire mt-8" aria-hidden="true" />

        <p className="text-center text-xs text-gray-500 mt-5">
          التلغراف © {new Date().getFullYear()} — صحيفة ثقافية
        </p>
      </div>
    </div>
  )
}
