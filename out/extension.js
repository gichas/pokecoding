"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const pokemonService_1 = require("./pokemonService");
const sidebarProvider_1 = require("./sidebarProvider");
// ─── Constants ────────────────────────────────────────────────────────────────
/** XP gained each time a file is saved. */
const XP_PER_SAVE = 100;
/** Total XP threshold (from 0) that triggers evolution. */
const XP_TO_EVOLVE = 1000;
/** Highest national Pokédex ID available in PokéAPI. */
const MAX_POKEMON_ID = 898;
// ─── State keys ──────────────────────────────────────────────────────────────
const KEY_OWNED = 'pokecoding.owned';
const KEY_POKEDEX = 'pokecoding.pokedex';
// ─── Activation ──────────────────────────────────────────────────────────────
function activate(context) {
    // Persist state across sessions via globalState
    let owned = context.globalState.get(KEY_OWNED) ?? null;
    let pokedex = context.globalState.get(KEY_POKEDEX) ?? [];
    // ── Sidebar ──────────────────────────────────────────────────────────────
    const sidebar = new sidebarProvider_1.SidebarProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('pokecoding.companion', sidebar));
    // Refresh sidebar once it resolves (it may resolve after state is loaded)
    sidebar.update(owned);
    // ── Helper: persist & refresh ────────────────────────────────────────────
    async function save() {
        await context.globalState.update(KEY_OWNED, owned);
        await context.globalState.update(KEY_POKEDEX, pokedex);
        sidebar.update(owned);
    }
    // ── Helper: trigger evolution ────────────────────────────────────────────
    async function triggerEvolution() {
        if (!owned?.evolvesIntoId) {
            return;
        }
        const prevName = owned.name;
        const nextId = owned.evolvesIntoId;
        const currentXp = owned.xp;
        try {
            const [newData, chain] = await Promise.all([
                (0, pokemonService_1.fetchPokemon)(nextId),
                (0, pokemonService_1.fetchEvolutionChain)(nextId),
            ]);
            // Find the stage after the newly evolved form
            const idx = chain.findIndex((s) => s.nationalId === nextId);
            const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;
            owned = {
                ...newData,
                rarity: owned.rarity, // keep original capture rarity
                xp: currentXp,
                evolvesIntoId: nextStage?.nationalId,
                xpToEvolve: nextStage ? currentXp + XP_TO_EVOLVE : undefined,
            };
            // Mark new form as caught in Pokédex
            if (!pokedex.includes(newData.id)) {
                pokedex.push(newData.id);
            }
            await context.globalState.update(KEY_OWNED, owned);
            await context.globalState.update(KEY_POKEDEX, pokedex);
            // Flash animation + info message
            sidebar.update(owned, true);
            vscode.window.showInformationMessage(`✨ ${prevName} évolue en ${newData.name} !`);
        }
        catch {
            // Silent fallback: clear pending evolution so we don't retry forever
            owned.evolvesIntoId = undefined;
            owned.xpToEvolve = undefined;
            await save();
        }
    }
    // ── Command: capture ─────────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('pokecoding.capture', async () => {
        const id = Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
        try {
            const [pkData, chain] = await Promise.all([
                (0, pokemonService_1.fetchPokemon)(id),
                (0, pokemonService_1.fetchEvolutionChain)(id),
            ]);
            // Locate the current form in the chain to find the next stage
            const idx = chain.findIndex((s) => s.nationalId === id);
            const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : undefined;
            owned = {
                ...pkData,
                rarity: (0, pokemonService_1.assignRarity)(),
                xp: 0,
                evolvesIntoId: nextStage?.nationalId,
                xpToEvolve: nextStage ? XP_TO_EVOLVE : undefined,
            };
            // Register in Pokédex
            if (!pokedex.includes(id)) {
                pokedex.push(id);
            }
            await save();
            vscode.window.showInformationMessage(`🎉 Vous avez capturé ${pkData.name} !`);
        }
        catch {
            vscode.window.showErrorMessage('Impossible de capturer un Pokémon. Vérifiez votre connexion.');
        }
    }));
    // ── Command: show Pokédex ─────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('pokecoding.showPokedex', () => {
        if (pokedex.length === 0) {
            vscode.window.showInformationMessage('Votre Pokédex est vide. Capturez un Pokémon !');
            return;
        }
        const sorted = [...pokedex].sort((a, b) => a - b);
        vscode.window.showInformationMessage(`Pokédex (${pokedex.length} capturé${pokedex.length > 1 ? 's' : ''}) : #${sorted.join(', #')}`);
    }));
    // ── XP on save ───────────────────────────────────────────────────────────
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async () => {
        if (!owned) {
            return;
        }
        owned.xp += XP_PER_SAVE;
        if (owned.evolvesIntoId && owned.xpToEvolve !== undefined && owned.xp >= owned.xpToEvolve) {
            await triggerEvolution();
        }
        else {
            await save();
        }
    }));
}
function deactivate() {
    // Nothing to clean up
}
//# sourceMappingURL=extension.js.map