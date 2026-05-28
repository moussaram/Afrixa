import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type EarningsChartProps = {
  data: Array<{ type: string; amount: number }>;
};

export const EarningsChart = ({ data }: EarningsChartProps) => (
  <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
    <h2 className="mb-4 font-bold text-white">Revenus</h2>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#2D2D4E" strokeDasharray="3 3" />
          <XAxis dataKey="type" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff' }} />
          <Bar dataKey="amount" fill="#10B981" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
