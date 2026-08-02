import Image from "next/image";

export function TruckClearanceGraphic() {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Will it fit?</p>
        <h2 className="text-2xl font-black sm:text-3xl">Truck height vs. the 12′4″ clearance</h2>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          Example vehicle heights shown to scale. Actual vehicle heights vary by model, load, suspension and equipment—drivers must know
          their vehicle height and obey the posted clearance.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl bg-[#071124]">
        <Image
          src="/truck-clearance-realistic.png"
          alt="To-scale vehicle height comparison showing a pickup, high-roof van, school bus, box truck, and semi trailer against the Peace Street bridge's 12 foot 4 inch clearance. The 13 foot 6 inch semi rises above the dashed clearance line."
          width={1490}
          height={335}
          priority={false}
          className="h-auto w-full"
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        The graphic is educational, not routing guidance. A nominally shorter vehicle can still be unsafe if its actual measured height
        exceeds the posted clearance or if roadway/vehicle conditions reduce margin.
      </p>
    </section>
  );
}
