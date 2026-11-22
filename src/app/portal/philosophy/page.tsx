import { BRAND_MESSAGE, MVV_PDF_PATH, PHILOSOPHY_SECTIONS, VALUES_DETAIL, WAY_OF_LIFE } from "@/lib/portal/philosophyContent";
import { BrandHero } from "@/components/portal/BrandHero";
import { Card, PageContainer } from "@/components/portal/ui";

export default function PhilosophyPage() {
  return (
    <PageContainer>
      <BrandHero>
        <p className="text-xs font-bold tracking-[0.2em] text-gold-300">{BRAND_MESSAGE.label}</p>
        <h1 className="mt-2 text-2xl font-bold leading-snug sm:text-3xl">{BRAND_MESSAGE.title}</h1>
        <p className="mt-2 text-xs tracking-[0.15em] text-brand-100">{BRAND_MESSAGE.en}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={MVV_PDF_PATH} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-gold-50">
            📄 理念ブック(PDF)を開く
          </a>
          <a href={MVV_PDF_PATH} download="Uchi_care_MVV.pdf" className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:text-white">
            ⬇ ダウンロード
          </a>
        </div>
      </BrandHero>

      <section className="mt-6 space-y-4">
        {PHILOSOPHY_SECTIONS.map((s) => (
          <Card key={s.key}>
            <p className="flex items-baseline gap-3">
              <span className="text-xs font-bold tracking-[0.2em] text-gold-600">{s.key}</span>
              <span className="text-xs font-semibold text-slate-500">{s.sub}</span>
            </p>
            <h2 className="mt-1 text-lg font-bold text-brand-700 sm:text-xl">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {s.body.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </Card>
        ))}
      </section>

      <section className="mt-8">
        <p className="text-xs font-bold tracking-[0.2em] text-gold-600">VALUES</p>
        <h2 className="mt-1 text-lg font-bold text-brand-700 sm:text-xl">日々の行動を支える5つの価値観</h2>
        <span className="mt-2 block h-0.5 w-10 rounded-full bg-gold-400" aria-hidden />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {VALUES_DETAIL.map((v) => (
            <Card key={v.name}>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-brand-700">{v.name}</span>
                <span className="text-[11px] font-bold tracking-[0.15em] text-gold-600">{v.en}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-800">{v.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {v.body.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-8 border-gold-200 bg-gold-50/40">
        <p className="text-xs font-bold text-gold-700">{WAY_OF_LIFE.label}</p>
        <h2 className="mt-1 text-lg font-bold text-brand-700 sm:text-xl">{WAY_OF_LIFE.title}</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p className="text-slate-600">
            {WAY_OF_LIFE.body.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
          <p className="font-bold text-brand-700">
            {WAY_OF_LIFE.emphasis.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
          <p className="text-slate-600">
            {WAY_OF_LIFE.closing.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
        </div>
      </Card>
    </PageContainer>
  );
}
