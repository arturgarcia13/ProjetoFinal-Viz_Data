import * as Plot from '@observablehq/plot';

/**
 * H2 — Dumbbell por partido (mediana F vs. M) e barras empilhadas por fonte (Público vs. Privado).
 */
export function renderH2Dumbbell(container, h2Data, { width = 700, onSelectParty = null } = {}) {
  container.innerHTML = '';
  const parties = h2Data.byParty.slice(0, 12);

  if (parties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com pelo menos 5 candidatas e 5 candidatos para comparar medianas.</p>';
    return;
  }

  const dumbbellRows = [];
  for (const p of parties) {
    dumbbellRows.push({ party: p.party, g: 'Mulheres', med: p.medF / 1000, ratio: p.ratio });
    dumbbellRows.push({ party: p.party, g: 'Homens', med: p.medM / 1000, ratio: p.ratio });
  }

  const dumbbell = Plot.plot({
    width,
    height: 340,
    marginTop: 22,
    marginRight: 24,
    marginBottom: 42,
    marginLeft: 95,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Receita mediana (R$ mil) →', grid: true },
    y: { label: null, domain: parties.map((p) => p.party) },
    color: { domain: ['Mulheres', 'Homens'], range: ['#b4452f', '#3d5a80'], legend: true },
    marks: [
      Plot.link(parties, {
        x1: (d) => d.medF / 1000,
        x2: (d) => d.medM / 1000,
        y1: 'party',
        y2: 'party',
        stroke: '#9b9183',
        strokeWidth: 2,
      }),
      Plot.dot(dumbbellRows, {
        x: 'med',
        y: 'party',
        fill: 'g',
        r: 5.5,
        title: (d) => `${d.party} · ${d.g}: R$ ${(d.med * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} (razão F/M: ${d.ratio.toFixed(2)}×)`,
        tip: true,
      }),
    ],
  });

  if (onSelectParty) {
    dumbbell.style.cursor = 'pointer';
    dumbbell.addEventListener('click', (ev) => {
      const t = ev.target?.querySelector?.('title')?.textContent;
      if (t) onSelectParty(t.split(' · ')[0]);
    });
  }

  // Barras empilhadas por fonte (F vs M)
  const sourceRows = [];
  for (const s of h2Data.sources) {
    const label = s.g === 'F' ? 'Mulheres' : 'Homens';
    sourceRows.push(
      { genero: label, fonte: 'FEFC', pct: s.pctFefc * 100 },
      { genero: label, fonte: 'Fundo Partidário', pct: s.pctFp * 100 },
      { genero: label, fonte: 'Recursos Próprios', pct: s.pctProp * 100 },
      { genero: label, fonte: 'Doações Privadas/Outros', pct: s.pctPriv * 100 },
    );
  }

  const stacked = Plot.plot({
    width,
    height: 170,
    marginTop: 22,
    marginRight: 24,
    marginBottom: 38,
    marginLeft: 95,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Composição do financiamento (%) →', domain: [0, 100], tickFormat: (d) => `${d}%` },
    y: { label: null },
    color: {
      domain: ['FEFC', 'Fundo Partidário', 'Recursos Próprios', 'Doações Privadas/Outros'],
      range: ['#b4452f', '#d97a4a', '#9c8f7d', '#3d5a80'],
      legend: true,
    },
    marks: [
      Plot.barX(sourceRows, {
        x: 'pct',
        y: 'genero',
        fill: 'fonte',
        title: (d) => `${d.genero} · ${d.fonte}: ${d.pct.toFixed(1)}%`,
        tip: true,
      }),
    ],
  });

  container.appendChild(dumbbell);
  container.appendChild(stacked);
}
