import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type GrowthChartProps = {
  data: Array<{ date: string; followers: number; views?: number }>;
};

export const GrowthChart = ({ data }: GrowthChartProps) => (
  <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
    <h2 className="mb-4 font-bold text-white">Croissance</h2>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2D2D4E" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip contentStyle={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff' }} />
          <Area type="monotone" dataKey="followers" stroke="#7C3AED" fill="url(#followersGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);
