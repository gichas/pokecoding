import * as vscode from 'vscode';
import { OwnedPokemon } from './pokemonService';

const RARITY_COLOR: Record<string, string> = {
  common: '#9e9e9e',
  uncommon: '#4caf50',
  rare: '#2196f3',
  legendary: '#ff9800',
};

const TYPE_COLOR: Record<string, string> = {
  fire: '#f57c00',
  water: '#1565c0',
  grass: '#2e7d32',
  electric: '#f9a825',
  psychic: '#880e4f',
  ice: '#006064',
  dragon: '#4a148c',
  dark: '#212121',
  fairy: '#ad1457',
  normal: '#757575',
  fighting: '#bf360c',
  flying: '#0277bd',
  poison: '#6a1b9a',
  ground: '#795548',
  rock: '#5d4037',
  bug: '#558b2f',
  ghost: '#4527a0',
  steel: '#546e7a',
};

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._buildHtml(null, false);
  }

  /** Re-renders the companion panel. Pass `evolving = true` to trigger the flash animation. */
  public update(pokemon: OwnedPokemon | null, evolving = false): void {
    if (this._view) {
      this._view.webview.html = this._buildHtml(pokemon, evolving);
    }
  }

  // ─── HTML builder ──────────────────────────────────────────────────────────

  private _buildHtml(pokemon: OwnedPokemon | null, evolving: boolean): string {
    if (!pokemon) {
      return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         display:flex; flex-direction:column; align-items:center; justify-content:center;
         height:100vh; margin:0; gap:12px; }
  .hint { opacity:.6; font-size:12px; text-align:center; padding:0 16px; }
  button { background:var(--vscode-button-background); color:var(--vscode-button-foreground);
           border:none; padding:8px 16px; cursor:pointer; border-radius:4px; font-size:13px; }
  button:hover { background:var(--vscode-button-hoverBackground); }
</style></head>
<body>
  <div style="font-size:48px">🎣</div>
  <p class="hint">Aucun Pokémon capturé.<br>Lancez <strong>PokéCoding: Capture a Pokémon</strong> pour commencer !</p>
</body>
</html>`;
    }

    const rarityColor = RARITY_COLOR[pokemon.rarity] ?? '#9e9e9e';
    const xpBarWidth = pokemon.xpToEvolve
      ? Math.min(100, Math.round((pokemon.xp / pokemon.xpToEvolve) * 100))
      : 100;

    const typeChips = pokemon.types
      .map((t) => {
        const bg = TYPE_COLOR[t] ?? '#607d8b';
        return `<span class="type" style="background:${bg}">${t}</span>`;
      })
      .join('');

    const evolutionBadge =
      pokemon.evolvesIntoId && pokemon.xpToEvolve
        ? `<div class="evo-badge">▶ Évolue à ${pokemon.xpToEvolve} XP</div>`
        : '';

    const flashClass = evolving ? ' flash' : '';

    return /* html */ `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    margin: 0;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  /* ── Sprite ──────────────────────────────────────────────────── */
  .sprite-wrap {
    position: relative;
    width: 96px;
    height: 96px;
  }
  .sprite {
    width: 96px;
    height: 96px;
    image-rendering: pixelated;
  }
  .sprite.flash {
    animation: flash 0.6s ease-out;
  }
  @keyframes flash {
    0%   { filter: brightness(1); }
    20%  { filter: brightness(8) saturate(0); }
    50%  { filter: brightness(5) saturate(0); }
    100% { filter: brightness(1); }
  }

  /* ── Name / rarity ───────────────────────────────────────────── */
  .name {
    font-size: 16px;
    font-weight: bold;
    text-transform: capitalize;
    margin: 0;
  }
  .rarity {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: ${rarityColor};
    margin: 0;
  }

  /* ── Types ───────────────────────────────────────────────────── */
  .types { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
  .type {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: capitalize;
  }

  /* ── XP bar ──────────────────────────────────────────────────── */
  .xp-section { width: 100%; }
  .xp-label {
    font-size: 11px;
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    opacity: .8;
  }
  .xp-track {
    width: 100%;
    height: 8px;
    background: var(--vscode-editorWidget-background, #333);
    border-radius: 4px;
    overflow: hidden;
  }
  .xp-fill {
    height: 100%;
    width: ${xpBarWidth}%;
    background: linear-gradient(90deg, #43a047, #76ff03);
    border-radius: 4px;
    transition: width .4s ease;
  }

  /* ── Evolution badge ─────────────────────────────────────────── */
  .evo-badge {
    font-size: 11px;
    color: #ffb300;
    background: rgba(255,179,0,.12);
    border: 1px solid rgba(255,179,0,.35);
    border-radius: 6px;
    padding: 3px 8px;
  }

  /* ── Pokédex counter ─────────────────────────────────────────── */
  .dex-note {
    font-size: 11px;
    opacity: .55;
  }

  /* ── National ID ─────────────────────────────────────────────── */
  .nat-id {
    font-size: 11px;
    opacity: .45;
  }
</style>
</head>
<body>
  <div class="sprite-wrap">
    <img class="sprite${flashClass}" src="${pokemon.sprite}" alt="${pokemon.name}" />
  </div>

  <p class="nat-id">#${String(pokemon.id).padStart(3, '0')}</p>
  <p class="name">${pokemon.name}</p>
  <p class="rarity">${pokemon.rarity}</p>

  <div class="types">${typeChips}</div>

  <div class="xp-section">
    <div class="xp-label">
      <span>XP</span>
      <span>${pokemon.xp}${pokemon.xpToEvolve ? ' / ' + pokemon.xpToEvolve : ''}</span>
    </div>
    <div class="xp-track"><div class="xp-fill"></div></div>
  </div>

  ${evolutionBadge}
</body>
</html>`;
  }
}
