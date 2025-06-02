import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window, commands } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const outputChannel = window.createOutputChannel('Hyperscript LSP');
  
  // Get server path from configuration or use bundled version
  const config = workspace.getConfiguration('hyperscript-lsp');
  const userServerPath = config.get<string>('serverPath');
  
  let serverPath: string;
  if (userServerPath && fs.existsSync(userServerPath)) {
    serverPath = userServerPath;
    outputChannel.appendLine(`Using user-configured LSP server: ${serverPath}`);
  } else {
    serverPath = context.asAbsolutePath(path.join('bundled-server', 'main.js'));
    outputChannel.appendLine(`Using bundled LSP server: ${serverPath}`);
  }

  // Check if server exists
  if (!fs.existsSync(serverPath)) {
    window.showErrorMessage(
      'Hyperscript LSP server not found. Please check the server path in settings.'
    );
    return;
  }

  // Server options
  const serverOptions: ServerOptions = {
    run: {
      command: 'node',
      args: [serverPath],
      transport: TransportKind.stdio
    },
    debug: {
      command: 'node',
      args: [serverPath, '--inspect=6009'],
      transport: TransportKind.stdio
    }
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'hyperscript' },
      { scheme: 'untitled', language: 'hyperscript' },
      // Also support hyperscript in HTML files
      { 
        scheme: 'file', 
        language: 'html',
        pattern: '**/*.{html,htm}'
      }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{hs,_hs}')
    },
    outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: {
      completionTriggerCharacters: config.get('completionTriggerCharacters'),
      enableDiagnostics: config.get('enableDiagnostics')
    }
  };

  // Create and start the client
  client = new LanguageClient(
    'hyperscriptLSP',
    'Hyperscript Language Server',
    serverOptions,
    clientOptions
  );

  // Register commands
  const showOutputCommand = commands.registerCommand('hyperscript-lsp.showOutput', () => {
    outputChannel.show();
  });

  const restartCommand = commands.registerCommand('hyperscript-lsp.restart', async () => {
    if (client) {
      await client.stop();
      await client.start();
      window.showInformationMessage('Hyperscript LSP restarted');
    }
  });

  context.subscriptions.push(showOutputCommand, restartCommand);

  // Start the client
  client.start().then(() => {
    outputChannel.appendLine('Hyperscript LSP started successfully');
  }).catch(err => {
    outputChannel.appendLine(`Failed to start Hyperscript LSP: ${err}`);
    window.showErrorMessage(`Failed to start Hyperscript LSP: ${err.message}`);
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}