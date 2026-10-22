import * as d3 from 'd3';

export const CARGO = {
  'DEPUTADO FEDERAL': { short: 'Federal', code: '6' },
  'DEPUTADO ESTADUAL': { short: 'Estadual', code: '7' },
  'DEPUTADO DISTRITAL': { short: 'Distrital', code: '8' }
};

export const UF_CODES = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

export const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará',
  PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins'
};

export const RACE_LABEL = {
  BRANCA: 'Branca', PARDA: 'Parda', PRETA: 'Preta', AMARELA: 'Amarela',
  INDÍGENA: 'Indígena', 'NÃO DIVULGÁVEL': 'Não divulgável'
};

export async function loadDashboard() {
  const [raw, geo, hubNetwork] = await Promise.all([
    d3.json('data/dashboard.json'),
    d3.json('data/br_uf.json'),
    d3.json('data/hubs_network.json').catch(() => null)
  ]);

  const d = raw.dict;
  const candidates = raw.candidates.map(a => ({
    y: a[0],
    g: a[1] ? 'F' : 'M',
    race: d.race[a[2]],
    p: d.p[a[3]],
    leg: d.leg[a[4]],
    uf: d.uf[a[5]],
    cargo: d.cargo[a[6]],
    v: a[7],
    el: a[8],
    cs: a[9],
    fin: a[10],
    final: a[11],
    r: a[12],
    fefc: a[13],
    party: a[14],
    priv: a[15],
    cand: a[16],
    candFefc: a[17],
    otherR: a[18],
    e: a[19],
    toCand: a[20],
    toParty: a[21],
    toOther: a[22],
    shared: a[23],
    dup: a[24],
    rN: a[25],
    eN: a[26]
  }));

  // A chapa é a unidade da cota: legenda/federação × UF × cargo, no mesmo ano.
  const groups = d3.group(candidates, c => `${c.y}|${c.leg}|${c.uf}|${c.cargo}`);
  for (const [key, rows] of groups) {
    const women = rows.filter(c => c.g === 'F').length;
    const pct = women / rows.length;
    const [y, leg, uf, cargo] = key.split('|');
    for (const c of rows) {
      c.slateKey = key;
      c.slate = pct;
      c.slateN = rows.length;
      c.slateF = women;
      const delta = women - Math.ceil(0.30 * rows.length);
      c.slateDelta = delta;
      // A faixa “limiar” é definida pela folga inteira, não só pelo percentual:
      // Δ = N mulheres − ⌈30% × N total⌉ ≤ 1.
      c.slateBand = pct < 0.30 ? '<30'
        : (pct < 0.3334 && delta <= 1) ? '30–33'
        : pct < 0.40 ? '33–40' : '40+';
      c.slateLabel = `${leg} · ${uf} · ${CARGO[cargo]?.short || cargo}`;
    }
  }

  return { candidates, suppliers: raw.suppliers, hubNetwork, geo, meta: raw.meta };
}
