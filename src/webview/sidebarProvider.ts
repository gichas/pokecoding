import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SaveData, OwnedPokemon } from '../models';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(message => {
      this._onMessage(message);
    });
  }

  private _onMessage(message: { type: string; nationalId?: number }): void {
    switch (message.type) {
      case 'setActive':
        if (message.nationalId !== undefined) {
          this._onSetActive?.(message.nationalId);
        }
        break;
      case 'getPokedex':
        if (this._currentData) {
          this._view?.webview.postMessage({
            type: 'pokedex',
            entries: this._currentData.pokedex
          });
        }
        break;
    }
  }

  private _onSetActive?: (nationalId: number) => void;
  private _currentData?: SaveData;

  setOnActiveChange(callback: (nationalId: number) => void): void {
    this._onSetActive = callback;
  }

  refresh(data: SaveData): void {
    this._currentData = data;
    if (this._view) {
      this._view.webview.postMessage({ type: 'update', data });
    }
  }

  notifyCapture(pokemon: OwnedPokemon, data: SaveData): void {
    this._currentData = data;
    if (this._view) {
      this._view.webview.postMessage({ type: 'update', data, newCapture: pokemon });
    }
  }

  private _getHtml(): string {
    const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'panel.html');
    try {
      return fs.readFileSync(htmlPath, 'utf8');
    } catch {
      return '<html><body><p>Erreur de chargement de la sidebar.</p></body></html>';
    }
  }
}
