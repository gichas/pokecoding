import * as vscode from 'vscode';
import { XpManager } from './xpManager';
import { PokemonService, rollPokemonId, fetchEvolutionChain } from './pokemonService';
import { SaveManager } from './saveManager';
import { SidebarProvider } from './webview/sidebarProvider';
import { SaveData, OwnedPokemon, PokedexEntry } from './models';

/** XP cost for evolutions with no min_level (trade / happiness / etc.). */
const XP_FALLBACK_EVOLVE = 1500;

/**
 * Returns the totalXp threshold at which the next evolution triggers.
 * Uses min_level × 100 when available; falls back to XP_FALLBACK_EVOLVE.
 */
function calcXpToEvolve(currentTotalXp: number, minLevel: number | undefined): number {
  return currentTotalXp + (minLevel ? minLevel * 100 : XP_FALLBACK_EVOLVE);
}

let saveManager: SaveManager;
let saveData: SaveData;
let sidebarProvider: SidebarProvider;

export function activate(context: vscode.ExtensionContext): void {
  // 1. Load save
  saveManager = new SaveManager(context);
  saveData = saveManager.load();

  // 2. Services
  const pokemonService = new PokemonService();

  // 3. XP Manager with capture callback
  const xpManager = new XpManager(saveData.pendingXp, () => {
    void triggerCapture(pokemonService);
  });

  // 4. Sidebar provider
  sidebarProvider = new SidebarProvider(context.extensionUri);
  sidebarProvider.setOnActiveChange((nationalId: number) => {
    saveData.activePokemonId = nationalId;
    void saveManager.save(saveData);
    sidebarProvider.refresh(saveData);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pokecoding.sidebar', sidebarProvider)
  );

  // 5. Listen for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.scheme !== 'file') return;

      const inserted = event.contentChanges
        .filter(c => c.text.length > 0)
        .reduce((sum, c) => sum + c.text.length, 0);

      if (inserted > 0) {
        const xp = Math.min(inserted, 20);
        xpManager.addXp(xp);
        saveData.totalXp += xp;
        saveData.pendingXp = xpManager.getPendingXp();

        // Check if the active companion can evolve
        const activePokemon = saveData.collection.find(
          p => p.nationalId === saveData.activePokemonId
        );
        if (
          activePokemon?.evolvesIntoId !== undefined &&
          activePokemon.xpToEvolve !== undefined &&
          saveData.totalXp >= activePokemon.xpToEvolve
        ) {
          void triggerEvolution(pokemonService, activePokemon);
        } else {
          sidebarProvider.refresh(saveData);
        }
      }
    })
  );

  // 6. Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('pokecoding.resetProgress', async () => {
      const choice = await vscode.window.showWarningMessage(
        'Réinitialiser toute la progression PokéCoding ? Cette action est irréversible.',
        'Confirmer',
        'Annuler'
      );
      if (choice === 'Confirmer') {
        saveData = await saveManager.reset();
        xpManager.setPendingXp(0);
        sidebarProvider.refresh(saveData);
        vscode.window.showInformationMessage('PokéCoding : progression réinitialisée.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pokecoding.showPokedex', () => {
      vscode.commands.executeCommand('pokecoding.sidebar.focus');
    })
  );
}

async function triggerCapture(pokemonService: PokemonService): Promise<void> {
  try {
    const id = rollPokemonId();
    const [pokemon, chain] = await Promise.all([
      pokemonService.fetchPokemon(id),
      fetchEvolutionChain(id),
    ]);

    // Find the next evolution stage for this Pokémon
    const idx = chain.findIndex(s => s.nationalId === id);
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;
    if (nextStage) {
      pokemon.evolvesIntoId = nextStage.nationalId;
      pokemon.xpToEvolve = calcXpToEvolve(saveData.totalXp, nextStage.minLevel);
    }

    // Add to collection
    saveData.collection.push(pokemon);

    // Update pendingXp to reflect post-capture state
    saveData.pendingXp = 0;

    // Update or create Pokédex entry
    const existingEntry = saveData.pokedex.find(e => e.nationalId === pokemon.nationalId);
    if (existingEntry) {
      existingEntry.caught = true;
      if (pokemon.isShiny) existingEntry.caughtShiny = true;
    } else {
      const newEntry: PokedexEntry = {
        nationalId: pokemon.nationalId,
        name: pokemon.name,
        type1: pokemon.type1,
        type2: pokemon.type2,
        generation: pokemon.generation,
        caught: true,
        caughtShiny: pokemon.isShiny,
        spriteUrl: pokemon.fallbackUrl
      };
      saveData.pokedex.push(newEntry);
    }

    // Set as active companion if first Pokémon or no active yet
    if (saveData.activePokemonId === null) {
      saveData.activePokemonId = pokemon.nationalId;
    }

    // Save and refresh UI
    await saveManager.save(saveData);
    sidebarProvider.refresh(saveData);

    // VS Code toast notification
    const msg = pokemon.isShiny
      ? `✨ SHINY ! ${pokemon.name} (${pokemon.rarity}) !!!`
      : `🎉 Nouveau Pokémon : ${pokemon.name} (${pokemon.rarity}) !`;
    vscode.window.showInformationMessage(msg);
  } catch {
    // Silent fail — never crash on capture error
  }
}

async function triggerEvolution(
  pokemonService: PokemonService,
  current: OwnedPokemon
): Promise<void> {
  if (current.evolvesIntoId === undefined) { return; }

  try {
    const nextId = current.evolvesIntoId;
    const [evolved, chain] = await Promise.all([
      pokemonService.fetchPokemon(nextId),
      fetchEvolutionChain(nextId),
    ]);

    // Preserve the original rarity and carry over shiny status
    evolved.rarity = current.rarity;
    evolved.isShiny = current.isShiny;

    // Find whether the evolved form can further evolve
    const idx = chain.findIndex(s => s.nationalId === nextId);
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;
    if (nextStage) {
      evolved.evolvesIntoId = nextStage.nationalId;
      evolved.xpToEvolve = calcXpToEvolve(saveData.totalXp, nextStage.minLevel);
    }

    // Replace the old form in the collection
    const collectionIdx = saveData.collection.findIndex(
      p => p.nationalId === current.nationalId
    );
    if (collectionIdx >= 0) {
      saveData.collection[collectionIdx] = evolved;
    } else {
      saveData.collection.push(evolved);
    }

    // If the evolved form was the active companion, update the active ID
    if (saveData.activePokemonId === current.nationalId) {
      saveData.activePokemonId = evolved.nationalId;
    }

    // Update or add Pokédex entry for the evolved form
    const existingEntry = saveData.pokedex.find(e => e.nationalId === evolved.nationalId);
    if (existingEntry) {
      existingEntry.caught = true;
      if (evolved.isShiny) { existingEntry.caughtShiny = true; }
    } else {
      const newEntry: PokedexEntry = {
        nationalId: evolved.nationalId,
        name: evolved.name,
        type1: evolved.type1,
        type2: evolved.type2,
        generation: evolved.generation,
        caught: true,
        caughtShiny: evolved.isShiny,
        spriteUrl: evolved.fallbackUrl,
      };
      saveData.pokedex.push(newEntry);
    }

    await saveManager.save(saveData);
    sidebarProvider.notifyCapture(evolved, saveData);
    vscode.window.showInformationMessage(
      `✨ ${current.name} évolue en ${evolved.name} !`
    );
  } catch {
    // Silent fallback — clear pending evolution so we don't retry forever
    current.evolvesIntoId = undefined;
    current.xpToEvolve = undefined;
    await saveManager.save(saveData);
    sidebarProvider.refresh(saveData);
  }
}

export function deactivate(): void {
  if (saveManager && saveData) {
    // Fire-and-forget save on deactivation
    void saveManager.save(saveData);
  }
}
