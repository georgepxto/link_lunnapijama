import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ALBUNS = [
  'https://photos.google.com/share/AF1QipMWBYLf90gEi0eVwJbfuqWwSzBcS7PHVagSjVanhI0vgd_5BEtGOSICdreIqmxTgA?key=NjNoZmpwS1N6cTV2bk9TbG9YaHVpNS0wZUhBNHJn',
  'https://photos.google.com/share/AF1QipOLhSotoeBEOpxXoUVeiA--y9mHiXnBdKjSXqAA_bA7KCoqpdEQbTxdE26IfD2L4Q?key=U0lkUHVTeVM5S25vaWlvTHB3bkVuejV2bTJlUFN3',
  'https://photos.google.com/share/AF1QipPMeNv5ECvG9uj-od6uERuJdLfelQEl-v4uvgaTLjiJgf-DasdtEpmgBq_fpQDDgA?key=cnh2M2hmakRFS2lJVkdkekJadVk1SVFXNEVEVFFB',
  'https://photos.google.com/share/AF1QipO3j-rowIMd2GBPnQ_MoRdb7lmu3VCuMYOXs_kZ-5VeYLigIT_RGblQXN8g2Hz_6A?key=RGlSbmdULUZfSGdOSjRSY29uUVU5UEdJQTBndm5n',
  'https://photos.google.com/share/AF1QipP2ZPJN1QspORHyknOo_aRMSAXy96IOexApq8Dxmd2A2ehKXKI36T1b1sAqtpMgAw?key=cHgwV0tTSEJ5eURHejJ2dU5lUGhSX09DSzJ2QUlB',
  'https://photos.google.com/share/AF1QipPHz_x_6NkSZDCji9Wk3ukYJCS2Kq7SqkMppvTn7Zi9DzH1YxH-P9bgbsqKAhfXCQ?key=RTh1WWJ0NFFsTzRLZVFVY295a1Y3OHRQRmplT0NB',
  'https://photos.google.com/share/AF1QipM48XCu0jqXMzrh_ClrHtgflEKzHX-cXvbps4QV8qMMqs8Dx_XjxGRViteHzik8Ig?key=VTFCNG1qU0lEY1YzR2tLMFNYbGxkT1hPclprdnRB',
  'https://photos.google.com/share/AF1QipMakivAnB_R-efNgLju-T3WN-nj5I1inBkIVQ9cJAlE5qhyckKCIG15RrZLon40MA?key=cklDQXpUR3dacDd2MmFoNnVYSm1xb3dRRjkzZllR'
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_IMG = path.join(RAIZ, 'assets/img/albuns');
const ARQUIVO_JSON = path.join(RAIZ, 'assets/data/albuns.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CONCORRENCIA = 4;

const idDoAlbum = (url) => new URL(url).pathname.split('/').pop();

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, codigo) => {
    if (codigo[0] === '#') {
      const n = codigo[1].toLowerCase() === 'x' ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return String.fromCodePoint(n);
    }
    return ENTIDADES[codigo.toLowerCase()] ?? inteiro;
  });
}

function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'album';
}

function metaProperty(html, propriedade) {
  const tag = html.match(new RegExp(`<meta[^>]+property=["']${propriedade}["'][^>]*>`, 'i'));
  if (!tag) return null;
  const conteudo = tag[0].match(/content=["']([^"']*)["']/i);
  return conteudo ? decodificar(conteudo[1]) : null;
}

function extrairTitulo(html) {
  const bruto = metaProperty(html, 'og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1];
  if (!bruto) throw new Error('título não encontrado');
  return decodificar(bruto)
    .replace(/\s*[-–—|]\s*Google (Fotos|Photos)\s*$/i, '')
    .replace(/\s+·\s+.*$/, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .trim();
}

const URL_FOTO = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+/g;

function extrairFotos(html) {
  const corpo = html.replace(/<(meta|link)\b[^>]*>/gi, '');
  const ocorrencias = corpo.match(URL_FOTO) ?? [];
  const capa = metaProperty(html, 'og:image')?.match(URL_FOTO)?.[0];

  if (capa && ocorrencias[0] === capa && ocorrencias.indexOf(capa, 1) > 0) ocorrencias.shift();

  return [...new Set(ocorrencias)];
}

async function baixar(url) {
  const resposta = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow'
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url.slice(0, 80)}…`);
  return resposta;
}

const hex = ({ r, g, b }) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');

async function processarFoto(base, pasta, slug, indice) {
  const nome = String(indice + 1).padStart(2, '0');
  const original = Buffer.from(await (await baixar(`${base}=w1600`)).arrayBuffer());
  const imagem = sharp(original).rotate();

  const grande = await imagem.clone()
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });

  const mini = await imagem.clone()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const { dominant } = await sharp(mini).stats();

  await writeFile(path.join(pasta, `${nome}.webp`), grande.data);
  await writeFile(path.join(pasta, `${nome}-mini.webp`), mini);

  return {
    src: `assets/img/albuns/${slug}/${nome}.webp`,
    mini: `assets/img/albuns/${slug}/${nome}-mini.webp`,
    w: grande.info.width,
    h: grande.info.height,
    cor: hex(dominant)
  };
}

async function emLotes(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await tarefa(itens[i], i);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

async function limparPasta(pasta, manter) {
  for (const arquivo of await readdir(pasta)) {
    if (!manter.has(arquivo)) await rm(path.join(pasta, arquivo), { force: true });
  }
}

async function importarAlbum(url, slugsUsados) {
  const html = await (await baixar(url)).text();
  const titulo = extrairTitulo(html);
  const bases = extrairFotos(html);
  if (!bases.length) throw new Error('nenhuma foto encontrada');

  let slug = slugificar(titulo);
  for (let n = 2; slugsUsados.has(slug); n++) slug = `${slugificar(titulo)}-${n}`;

  console.log(`  "${titulo}" → ${bases.length} fotos encontradas`);

  const pasta = path.join(PASTA_IMG, slug);
  await mkdir(pasta, { recursive: true });

  const fotos = await emLotes(bases, CONCORRENCIA, (base, i) => processarFoto(base, pasta, slug, i));
  await limparPasta(pasta, new Set(fotos.flatMap((f) => [path.basename(f.src), path.basename(f.mini)])));

  return { id: idDoAlbum(url), slug, titulo, capa: 0, fotos };
}

async function lerAntigos() {
  if (!existsSync(ARQUIVO_JSON)) return [];
  try {
    return JSON.parse(await readFile(ARQUIVO_JSON, 'utf8'));
  } catch {
    return [];
  }
}

async function main() {
  const antigos = await lerAntigos();
  const albuns = [];
  const slugsUsados = new Set();
  const falhas = [];

  await mkdir(PASTA_IMG, { recursive: true });
  await mkdir(path.dirname(ARQUIVO_JSON), { recursive: true });

  for (const [i, url] of ALBUNS.entries()) {
    console.log(`Álbum ${i + 1}/${ALBUNS.length}`);
    try {
      const album = await importarAlbum(url, slugsUsados);
      slugsUsados.add(album.slug);
      albuns.push(album);
    } catch (erro) {
      falhas.push(i + 1);
      const antigo = antigos.find((a) => a.id === idDoAlbum(url));
      if (antigo && !slugsUsados.has(antigo.slug)) {
        console.warn(`  ⚠ falhou (${erro.message}); mantendo os dados antigos de "${antigo.titulo}"`);
        slugsUsados.add(antigo.slug);
        albuns.push(antigo);
      } else {
        console.warn(`  ⚠ falhou (${erro.message}); sem dados antigos, álbum ignorado`);
      }
    }
  }

  for (const pasta of await readdir(PASTA_IMG)) {
    if (!slugsUsados.has(pasta)) await rm(path.join(PASTA_IMG, pasta), { recursive: true, force: true });
  }

  await writeFile(ARQUIVO_JSON, JSON.stringify(albuns, null, 2) + '\n');

  console.log('\nResumo:');
  for (const a of albuns) console.log(`  ${a.titulo}: ${a.fotos.length} fotos`);
  console.log(`  Total: ${albuns.reduce((s, a) => s + a.fotos.length, 0)} fotos em ${albuns.length} álbuns`);
  if (falhas.length) console.warn(`  Álbuns com falha: ${falhas.join(', ')}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
