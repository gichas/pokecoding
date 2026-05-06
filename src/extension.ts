import * as vscode from 'vscode';
import {
  fetchPokemon,
  fetchEvolutionChain,
  assignRarity,
  OwnedPokemon,
} from './pokemonService';
import { SidebarProvider } from './sidebarProvider';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum XP awarded per onDidChangeTextDocument event (anti-paste-spam). */
const XP_PER_EVENT_MAX = 20;

/** XP cost for evolutions with no min_level data (trade / happiness / etc.). */
const XP_FALLBACK_EVOLVE = 1500;

/** Highest national Pokédex ID available in PokéAPI. */
const MAX_POKEMON_ID = 898;

// ─── State keys ──────────────────────────────────────────────────────────────

const KEY_OWNED = 'pokecoding.owned';
const KEY_POKEDEX = 'pokecoding.pokedex';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculates the absolute XP value at which the next evolution triggers.
 * Uses min_level from the evolution chain when available (min_level × 100).
 * Falls back to XP_FALLBACK_EVOLVE for trade / happiness / special evolutions.
 */
function calcXpToEvolve(currentXp: number, minLevel: number | undefined): number {
  return currentXp + (minLevel ? minLevel * 100 : XP_FALLBACK_EVOLVE);
}

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // Persist state across sessions via globalState
  let owned: OwnedPokemon | null = context.globalState.get<OwnedPokemon>(KEY_OWNED) ?? null;
  let pokedex: number[] = context.globalState.get<number[]>(KEY_POKEDEX) ?? [];

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebar = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pokecoding.companion', sidebar)
  );

  // Refresh sidebar once it resolves (it may resolve after state is loaded)
  sidebar.update(owned);

  // ── Helper: persist & refresh ────────────────────────────────────────────
  async function save(): Promise<void> {
    await context.globalState.update(KEY_OWNED, owned);
    await context.globalState.update(KEY_POKEDEX, pokedex);
    sidebar.update(owned);
  }

  // ── Helper: trigger evolution ────────────────────────────────────────────
  async function triggerEvolution(): Promise<void> {
    if (!owned?.evolvesIntoId) {
      return;
    }

    const prevName = owned.name;
    const nextId = owned.evolvesIntoId;
    const currentXp = owned.xp;

    try {
      const [newData, chain] = await Promise.all([
        fetchPokemon(nextId),
        fetchEvolutionChain(nextId),
      ]);

      // Find the stage after the newly evolved form
      const idx = chain.findIndex((s) => s.nationalId === nextId);
      const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;

      owned = {
        ...newData,
        rarity: owned.rarity,        // keep original capture rarity
        xp: currentXp,
        evolvesIntoId: nextStage?.nationalId,
        xpToEvolve: nextStage ? calcXpToEvolve(currentXp, nextStage.minLevel) : undefined,
      };

      // Mark new form as caught in Pokédex
      if (!pokedex.includes(newData.id)) {
        pokedex.push(newData.id);
      }

      await context.globalState.update(KEY_OWNED, owned);
      await context.globalState.update(KEY_POKEDEX, pokedex);

      // Flash animation + info message
      sidebar.update(owned, true);
      vscode.window.showInformationMessage(
        `✨ ${prevName} évolue en ${newData.name} !`
      );
    } catch {
      // Silent fallback: clear pending evolution so we don't retry forever
      owned.evolvesIntoId = undefined;
      owned.xpToEvolve = undefined;
      await save();
    }
  }

  // ── Command: capture ─────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('pokecoding.capture', async () => {
      const id = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;

      try {
        const [pkData, chain] = await Promise.all([
          fetchPokemon(id),
          fetchEvolutionChain(id),
        ]);

        // Locate the current form in the chain to find the next stage
        const idx = chain.findIndex((s) => s.nationalId === id);
        const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;

        owned = {
          ...pkData,
          rarity: assignRarity(),
          xp: 0,
          evolvesIntoId: nextStage?.nationalId,
          xpToEvolve: nextStage ? calcXpToEvolve(0, nextStage.minLevel) : undefined,
        };

        // Register in Pokédex
        if (!pokedex.includes(id)) {
          pokedex.push(id);
        }

        await save();
        vscode.window.showInformationMessage(
          `🎉 Vous avez capturé ${pkData.name} !`
        );
      } catch {
        vscode.window.showErrorMessage(
          'Impossible de capturer un Pokémon. Vérifiez votre connexion.'
        );
      }
    })
  );

  // ── Command: show Pokédex ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('pokecoding.showPokedex', () => {
      if (pokedex.length === 0) {
        vscode.window.showInformationMessage('Votre Pokédex est vide. Capturez un Pokémon !');
        return;
      }
      const sorted = [...pokedex].sort((a, b) => a - b);
      vscode.window.showInformationMessage(
        `Pokédex (${pokedex.length} capturé${pokedex.length > 1 ? 's' : ''}) : #${sorted.join(', #')}`
      );
    })
  );

  // ── XP on text change ────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (!owned) {
        return;
      }

      // Sum lengths of all inserted text in this event
      const inserted = event.contentChanges.reduce(
        (sum, change) => sum + (change.text.length > 0 ? change.text.length : 0),
        0
      );

      if (inserted === 0) {
        return;  // deletions / no-ops don't award XP
      }

      // At least 1 XP per event; cap at XP_PER_EVENT_MAX to avoid paste spam
      const xpGained = Math.min(Math.max(inserted, 1), XP_PER_EVENT_MAX);
      owned.xp += xpGained;

      if (owned.evolvesIntoId && owned.xpToEvolve !== undefined && owned.xp >= owned.xpToEvolve) {
        await triggerEvolution();
      } else {
        await save();
      }
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up
}
