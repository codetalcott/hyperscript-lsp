# VS Code Hyperscript LSP Extension

This extension combines the existing Hyperscript syntax highlighting from [dz4k/vscode-hyperscript](https://github.com/dz4k/vscode-hyperscript) with our Language Server Protocol implementation.

## Integration Plan

### 1. Fork and Extend Approach

```bash
# Fork dz4k/vscode-hyperscript
git clone https://github.com/dz4k/vscode-hyperscript.git
cd vscode-hyperscript

# Add LSP client dependencies
npm install vscode-languageclient vscode-languageserver-protocol
```

### 2. Modify package.json

Add to the existing `package.json`:

```json
{
  "activationEvents": [
    "onLanguage:hyperscript"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "configuration": {
      "title": "Hyperscript",
      "properties": {
        "hyperscript.server.path": {
          "type": "string",
          "default": "",
          "description": "Path to the Hyperscript language server executable"
        },
        "hyperscript.trace.server": {
          "type": "string",
          "enum": ["off", "messages", "verbose"],
          "default": "off",
          "description": "Traces the communication between VS Code and the language server."
        }
      }
    }
  },
  "dependencies": {
    "vscode-languageclient": "^9.0.1"
  }
}
```

### 3. Create Extension Client

Create `src/extension.ts`:

```typescript
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // Server options
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );
  
  // Use the user-configured path if available
  const userServerPath = workspace.getConfiguration('hyperscript').get<string>('server.path');
  const serverPath = userServerPath || serverModule;

  const serverOptions: ServerOptions = {
    run: { 
      command: 'bun',
      args: ['run', serverPath],
      transport: TransportKind.stdio
    },
    debug: {
      command: 'bun',
      args: ['run', serverPath, '--inspect'],
      transport: TransportKind.stdio
    }
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'hyperscript' },
      { scheme: 'untitled', language: 'hyperscript' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.hs')
    }
  };

  // Create and start the client
  client = new LanguageClient(
    'hyperscriptLanguageServer',
    'Hyperscript Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
```

### 4. Bundle LSP Server

Add build script to bundle your LSP:

```json
{
  "scripts": {
    "bundle-lsp": "bun build ../src/server/main.ts --outdir ./server/out --target node",
    "vscode:prepublish": "npm run bundle-lsp && npm run compile"
  }
}
```

## Option 2: Separate Extension with Dependency

Create a new extension that depends on the syntax highlighter:

```json
{
  "name": "hyperscript-lsp",
  "displayName": "Hyperscript Language Server",
  "extensionDependencies": [
    "dz4k.hyperscript"
  ]
}
```

## Option 3: Contribute Back

Submit a PR to dz4k/vscode-hyperscript adding LSP support:

1. Keep syntax highlighting as-is
2. Add optional LSP client
3. Make it configurable

## Testing the Integration

1. **Install both extensions locally**:
   ```bash
   # Install syntax highlighter
   code --install-extension ./vscode-hyperscript-0.1.0.vsix
   
   # Install LSP extension
   code --install-extension ./hyperscript-lsp-0.1.0.vsix
   ```

2. **Test features**:
   - Syntax highlighting (from original extension)
   - Autocompletion (from LSP)
   - Hover documentation (from LSP)
   - Diagnostics (from LSP)

## Publishing Strategy

1. **Contact original author** (@dz4k) about collaboration
2. **Publish as companion extension** if separate
3. **Submit PR** if enhancing original

## Configuration for Users

Users would configure the extension:

```json
{
  "hyperscript.server.path": "/usr/local/bin/hyperscript-lsp",
  "hyperscript.trace.server": "verbose",
  "[hyperscript]": {
    "editor.quickSuggestions": {
      "other": true,
      "comments": false,
      "strings": true
    }
  }
}
```