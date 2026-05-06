import * as vscode from 'vscode';
import { SaveData } from './models';

const SAVE_KEY = 'pokecoding.save';

function createDefaultSave(): SaveData {
  return {
    playerName: 'Dresseur',
    totalXp: 0,
    pendingXp: 0,
    collection: [],
    pokedex: [],
    activePokemonId: null
  };
}

export class SaveManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  load(): SaveData {
    try {
      const saved = this.context.globalState.get<SaveData>(SAVE_KEY);
      if (!saved) return createDefaultSave();
      // Merge with defaults to handle missing fields from older saves
      return { ...createDefaultSave(), ...saved };
    } catch {
      return createDefaultSave();
    }
  }

  async save(data: SaveData): Promise<void> {
    try {
      await this.context.globalState.update(SAVE_KEY, data);
    } catch {
      // Silent fail — never crash the extension on save error
    }
  }

  async reset(): Promise<SaveData> {
    const fresh = createDefaultSave();
    await this.save(fresh);
    return fresh;
  }
}
