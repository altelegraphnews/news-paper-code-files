import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface ViewsChartProps {
  data: { date: string; views: number; visitors?: number | null }[]
  formatNumber: (n: number) => string
}

/**
 * Views per day, and visitors per day where they were counted. Lives in its
 * own file so recharts (~300 KB) is code-split out of the dashboard's first
 * paint and streams in behind a skeleton.
 */
export default function ViewsChart({ data, formatNumber }: ViewsChartProps) {
  const hasVisitors = data.some((d) => d.visitors != null)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(184, 146, 61, 0.15)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#7b8294' }} tickFormatter={(d) => d.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: '#7b8294' }} tickFormatter={formatNumber} />
        <Tooltip
          formatter={(v: number, name: string) => [formatNumber(v), name === 'visitors' ? 'زائر' : 'مشاهدة']}
          labelFormatter={(l) => `تاريخ: ${l}`}
          contentStyle={{ fontFamily: 'IBM Plex Sans Arabic', direction: 'rtl', borderRadius: 6, borderColor: '#e3dac6' }}
        />
        <Line type="monotone" dataKey="views" stroke="#b8923d" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#1c2331' }} />
        {hasVisitors && (
          <Line type="monotone" dataKey="visitors" stroke="#1c2331" strokeWidth={1.75} strokeDasharray="4 3" dot={false} activeDot={{ r: 3.5, fill: '#b8923d' }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
