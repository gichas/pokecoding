import * as vscode from 'vscode';
import { XpManager } from './xpManager';
import { PokemonService, rollPokemonId } from './pokemonService';
import { SaveManager } from './saveManager';
import { SidebarProvider } from './webview/sidebarProvider';
import { SaveData, PokedexEntry } from './models';

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
        sidebarProvider.refresh(saveData);
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
    const pokemon = await pokemonService.fetchPokemon(id);

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

export function deactivate(): void {
  if (saveManager && saveData) {
    // Fire-and-forget save on deactivation
    void saveManager.save(saveData);
  }
}
