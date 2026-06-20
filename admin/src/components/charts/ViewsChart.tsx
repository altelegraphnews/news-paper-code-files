import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface ViewsChartProps {
  data: { date: string; views: number }[]
  formatNumber: (n: number) => string
}

/**
 * The 30-day views line chart. Lives in its own file so recharts
 * (~300 KB) is code-split out of the dashboard's first paint and
 * streams in behind a skeleton.
 */
export default function ViewsChart({ data, formatNumber }: ViewsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(184, 146, 61, 0.15)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#7b8294' }} tickFormatter={(d) => d.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: '#7b8294' }} tickFormatter={formatNumber} />
        <Tooltip
          formatter={(v: number) => [formatNumber(v), 'مشاهدة']}
          labelFormatter={(l) => `تاريخ: ${l}`}
          contentStyle={{ fontFamily: 'IBM Plex Sans Arabic', direction: 'rtl', borderRadius: 6, borderColor: '#e3dac6' }}
        />
        <Line type="monotone" dataKey="views" stroke="#b8923d" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#1c2331' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
