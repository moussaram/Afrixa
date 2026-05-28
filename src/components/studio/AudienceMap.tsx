type AudienceMapProps = {
  countries: Record<string, number>;
};

export const AudienceMap = ({ countries }: AudienceMapProps) => {
  const entries = Object.entries(countries || {}).slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
      <h2 className="mb-4 font-bold text-white">Audience</h2>
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">Les pays principaux apparaîtront ici après les premières vues.</p>
        ) : (
          entries.map(([country, value]) => (
            <div key={country}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-white">{country}</span>
                <span className="text-[#9CA3AF]">{Math.round(value * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-[#7C3AED]" style={{ width: `${Math.min(100, value * 100)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
