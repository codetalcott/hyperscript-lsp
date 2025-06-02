# VS Code Hyperscript Development Setup

## Complete Setup Guide

### Prerequisites
- VS Code installed
- [dz4k.hyperscript](https://github.com/dz4k/vscode-hyperscript) extension (for syntax highlighting)
- Bun or Node.js installed

### Quick Start (3 Options)

#### Option 1: Use Pre-built Extension (Easiest)
```bash
# Build the extension
cd vscode-extension
npm install
npm run compile
npm run bundle-server
npm run package

# Install in VS Code
code --install-extension hyperscript-lsp-0.1.0.vsix
```

#### Option 2: Development Mode
```bash
# Open the extension in VS Code
code vscode-extension

# Press F5 to launch Extension Development Host
# This opens a new VS Code window with the extension loaded
```

#### Option 3: Use LSP Directly (Without Extension)
```bash
# Start LSP server
bun run src/server/main.ts

# Configure VS Code manually (settings.json):
```
```json
{
  "languageServerExample.trace.server": "verbose",
  "files.associations": {
    "*.hs": "hyperscript",
    "*._hs": "hyperscript"
  }
}
```

### Features Available

1. **Syntax Highlighting** (from dz4k.hyperscript)
   - Keywords, commands, expressions
   - Embedded in HTML `_` attributes
   - Standalone `.hs` files

2. **IntelliSense** (from our LSP)
   - ✅ Autocompletion for commands, keywords, expressions
   - ✅ Hover documentation with examples
   - ✅ Signature help
   - ✅ Syntax error diagnostics

3. **Code Navigation**
   - ✅ Go to Definition (for behaviors, functions)
   - ✅ Document symbols outline
   - 🔄 Find references (planned)

### Usage Examples

#### Example 1: HTML with Embedded Hyperscript
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://unpkg.com/hyperscript.org"></script>
</head>
<body>
    <!-- Type _ and get completions! -->
    <button _="on click toggle .active on me">
        Toggle Active
    </button>
    
    <!-- Hover over 'toggle' for documentation -->
    <div _="on mouseenter add .hover to me
            on mouseleave remove .hover from me">
        Hover Effects
    </div>
</body>
</html>
```

#### Example 2: Standalone Hyperscript File
```hyperscript
-- Save as behaviors.hs
behavior TodoList
  init
    -- Get completions after 'set'
    set 
  end
  
  on click from .add-btn
    -- Error: missing 'end' will be highlighted
    if #input.value is not empty
      make <li.todo-item/> called item
      put it into item
      put item at end of #list
  
end
```

### Recommended VS Code Settings

Add to your workspace `.vscode/settings.json`:

```json
{
  // Hyperscript LSP settings
  "hyperscript-lsp.enableDiagnostics": true,
  "hyperscript-lsp.trace.server": "messages",
  
  // Editor settings for Hyperscript
  "[hyperscript]": {
    "editor.quickSuggestions": {
      "other": true,
      "comments": false,
      "strings": true
    },
    "editor.suggestOnTriggerCharacters": true,
    "editor.wordBasedSuggestions": false,
    "editor.snippetSuggestions": "top",
    "editor.parameterHints.enabled": true,
    "editor.hover.enabled": true,
    "editor.hover.delay": 300
  },
  
  // File associations
  "files.associations": {
    "*.hs": "hyperscript",
    "*._hs": "hyperscript",
    "*.hyperscript": "hyperscript"
  }
}
```

### Keyboard Shortcuts

- **Ctrl/Cmd + Space**: Trigger completion
- **Ctrl/Cmd + Shift + Space**: Trigger signature help
- **F12**: Go to Definition
- **Ctrl/Cmd + Hover**: Show documentation
- **Ctrl/Cmd + Shift + O**: Show document symbols

### Troubleshooting

#### LSP Not Starting
1. Check Output panel: View → Output → Select "Hyperscript LSP"
2. Verify server path in settings
3. Check if port 3000 is available (for HTTP mode)

#### No Completions
1. Ensure file is saved with `.hs` extension
2. Check if dz4k.hyperscript extension is installed
3. Manually trigger with Ctrl+Space

#### Performance Issues
1. Disable diagnostics if too slow
2. Reduce completion trigger characters
3. Check database file size

### Extension Commands

Open Command Palette (Ctrl/Cmd + Shift + P):

- `Hyperscript: Show Output` - View LSP logs
- `Hyperscript: Restart Language Server` - Restart LSP
- `Hyperscript: Open Documentation` - Open hyperscript.org

### Contributing

1. **Report Issues**: GitHub issues for bugs/features
2. **Add Examples**: Submit PRs with new patterns
3. **Improve Grammar**: Enhance syntax highlighting

### Next Steps

1. Install both extensions
2. Create a test `.hs` file
3. Try autocompletion and hover
4. Report any issues

The combination of syntax highlighting + LSP provides a complete Hyperscript development experience!