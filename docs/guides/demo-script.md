# Hyperscript LSP Demo Script

## Demo Video Outline (3-5 minutes)

### 1. Opening (15 seconds)
"Hyperscript is powerful but can be challenging to learn. Today I'll show you how our Language Server makes it much easier!"

### 2. Setup (30 seconds)
- Show VS Code with both extensions installed
- Quick look at a hyperscript project structure

### 3. Feature Demos

#### A. Autocompletion (45 seconds)
```hyperscript
-- Type: "on cli" → shows completion
on click
  -- Type: "tog" → completes to "toggle"
  toggle .active on me
end
```

#### B. Hover Documentation (30 seconds)
- Hover over `toggle` → shows syntax and examples
- Hover over `on` → shows event handler docs
- "No more switching to documentation!"

#### C. Real-time Error Detection (30 seconds)
```hyperscript
on click
  if condition   -- Red squiggle appears
    toggle .active
  -- Missing 'end' error shown
```

#### D. MCP Integration with Claude (45 seconds)
- Switch to Claude Desktop
- "Check this hyperscript code"
- "Generate a todo list handler"
- Copy result back to VS Code

#### E. Complex Example (45 seconds)
Build a mini todo app showing:
- Behavior definition with completions
- Event handler suggestions
- Error prevention

### 4. Benefits Recap (30 seconds)
- ✅ Learn hyperscript faster
- ✅ Write correct code first time
- ✅ AI assistance when stuck
- ✅ Full IDE experience

### 5. Call to Action (15 seconds)
- "Get it at: github.com/..."
- "Try the MCP server with Claude"
- "Join the hyperscript community!"

## Key Screenshots/GIFs to Capture

1. **Completion Popup**
   - Show rich completions with descriptions
   - Highlight the command categories

2. **Hover Documentation**
   - Show markdown formatting
   - Include syntax examples

3. **Error Diagnostics**
   - Red squiggles for syntax errors
   - Helpful error messages

4. **Claude Integration**
   - Show code analysis
   - Pattern generation

5. **Before/After**
   - Split screen: Plain text editor vs. IDE experience

## Demo Code Snippets

### Simple Interactive Button
```html
<button _="on click 
           toggle .active 
           then settle
           then log 'Toggled!'">
  Click Me
</button>
```

### Form Validation
```hyperscript
behavior FormValidator
  on submit
    prevent default
    -- Completions help here!
    if #email.value is empty
      add .error to #email
    else
      remove .error from #email
    end
  end
end
```

### Animation Sequence
```hyperscript
on click
  add .spinning to me
  wait 2s
  remove .spinning from me
  transition opacity to 0 over 500ms
  then remove me
end
```

## Recording Tips

1. **VS Code Settings**
   - Increase font size (14-16px)
   - Use high contrast theme
   - Hide unnecessary panels

2. **Smooth Typing**
   - Type deliberately to show completions
   - Pause on hover for documentation
   - Let errors appear naturally

3. **Audio Notes**
   - Explain what's happening
   - Emphasize time savings
   - Sound enthusiastic!

4. **Post-Production**
   - Add arrows pointing to features
   - Highlight key shortcuts used
   - Include chapter markers

## Social Media Snippets

### Twitter/X
"🚀 Just made Hyperscript 10x easier to learn! Check out our new LSP with:
✨ Intelligent completions
📚 Inline documentation  
🔍 Real-time error checking
🤖 AI assistance via Claude

Demo: [link]
#hyperscript #webdev #LSP"

### Discord/Forum Post
"Hey Hyperscript community! 👋

Excited to share our new Language Server that makes writing Hyperscript much easier:
- Full IntelliSense support in VS Code
- Hover docs for every command
- AI-powered code generation
- Real-time syntax validation

Would love your feedback!"

### GitHub README Badge
```markdown
[![Hyperscript LSP](https://img.shields.io/badge/Hyperscript-LSP%20Ready-blue)](https://github.com/yourrepo/hyperscript-lsp)
```