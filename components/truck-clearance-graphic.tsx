const vehicles = [
  { label: "Pickup", height: 6.5, display: "6′6″", status: "clear", width: 90 },
  { label: "High-roof van", height: 9.5, display: "9′6″", status: "clear", width: 90 },
  { label: "School bus", height: 10.5, display: "10′6″", status: "clear", width: 105 },
  { label: "Box truck", height: 12.0, display: "12′0″", status: "caution", width: 100 },
  { label: "Semi trailer", height: 13.5, display: "13′6″", status: "blocked", width: 110 },
] as const;

const clearance = 12 + 4 / 12;
const groundY = 245;
const pixelsPerFoot = 13.5;
const clearanceY = groundY - clearance * pixelsPerFoot;

export function TruckClearanceGraphic() {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Will it fit?</p>
        <h2 className="text-2xl font-black sm:text-3xl">Truck height vs. the 12′4″ clearance</h2>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          Example vehicle heights shown to scale. Actual vehicle heights vary by model, load, suspension and equipment—drivers must know their vehicle height and obey the posted clearance.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-[#071124] p-3 sm:p-5">
        <svg viewBox="0 0 760 315" className="min-w-[700px] w-full" role="img" aria-label="To-scale comparison of example vehicle heights against the 12 foot 4 inch Peace Street bridge clearance">
          <rect x="24" y="26" width="712" height="32" rx="5" fill="#243047" />
          <rect x="24" y="58" width="712" height="12" fill="#121a2a" />
          <line x1="24" y1={clearanceY} x2="736" y2={clearanceY} stroke="#fbbf24" strokeWidth="2" strokeDasharray="7 7" />
          <text x="35" y={clearanceY - 8} fill="#fbbf24" fontSize="14" fontWeight="800">POSTED CLEARANCE 12′4″</text>
          <line x1="24" y1={groundY} x2="736" y2={groundY} stroke="#94a3b8" strokeWidth="3" />

          {vehicles.map((vehicle, index) => {
            const x = 48 + index * 138;
            const h = vehicle.height * pixelsPerFoot;
            const y = groundY - h;
            const fill = vehicle.status === "clear" ? "#38bdf8" : vehicle.status === "caution" ? "#fbbf24" : "#fb7185";
            const status = vehicle.status === "clear" ? "CLEARS" : vehicle.status === "caution" ? "ONLY 4″ MARGIN" : "TOO TALL";
            return (
              <g key={vehicle.label}>
                <rect x={x} y={y + h * 0.28} width={vehicle.width} height={h * 0.72} rx="7" fill={fill} opacity="0.92" />
                <rect x={x + 8} y={y} width={vehicle.width * 0.55} height={h * 0.38} rx="8" fill={fill} />
                <circle cx={x + 22} cy={groundY} r="9" fill="#020817" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx={x + vehicle.width - 20} cy={groundY} r="9" fill="#020817" stroke="#e2e8f0" strokeWidth="3" />
                <line x1={x + vehicle.width + 8} y1={y} x2={x + vehicle.width + 8} y2={groundY} stroke="#e2e8f0" strokeWidth="1.5" />
                <text x={x + vehicle.width + 12} y={y + 13} fill="#e2e8f0" fontSize="12" fontWeight="700">{vehicle.display}</text>
                <text x={x + vehicle.width / 2} y="273" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="800">{vehicle.label}</text>
                <text x={x + vehicle.width / 2} y="293" textAnchor="middle" fill={fill} fontSize="11" fontWeight="900">{status}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        The graphic is educational, not routing guidance. A nominally shorter vehicle can still be unsafe if its actual measured height exceeds the posted clearance or if roadway/vehicle conditions reduce margin.
      </p>
    </section>
  );
}
