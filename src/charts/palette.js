/**
 * Paleta Semântica Única do Projeto — versão editorial clara (papel creme).
 * Nenhuma cor se repete com significados conflitantes entre gráficos.
 */
export const SEMANTIC_PALETTE = {
  // Gênero (exclusivo em todo o site)
  women: '#D63FB0', // Rosa profundo = Mulheres
  men: '#4B636E',   // Ardósia petróleo = Homens (linha de base)

  // Conformidade / Alerta / Gap (exclusivo)
  ok: '#007D5B',    // Esmeralda = Cota respeitada / Superávit
  alert: '#E2481F', // Coral = Subfinanciamento / Déficit / Irregular (<30%)
  floor: '#C98A00', // Âmbar dourado = Limite operacional (30%–33,3%)

  // Anos / Série Temporal
  y2018: '#A3B3AC', // Cinza-sálvia
  y2022: '#142620', // Tinta escura (ou vazado)
  y2026: '#0E8C93', // Petróleo-ciano

  // Fontes de Receita (H2B e H4)
  fefc: '#0E8C93',
  fp: '#007D5B',
  prop: '#7B6CD9',
  priv: '#A3B3AC',

  // Etapas do Funil (H5)
  cand: '#7B6CD9',
  votes: '#0E8C93',
  elected: '#D63FB0',

  // Superfícies & Texto sobre papel claro
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE2',
  ink: '#142620',
  muted: '#3D524A',
  subtle: '#647A71',
  grid: 'rgba(20, 38, 32, 0.12)',
};
