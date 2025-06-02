import type { GeneratePattern } from '../types.js';

export class GeneratorService {
  private patterns: Record<GeneratePattern, (options?: any) => string> = {
    'event-handler': (options) => {
      const event = options?.event || 'click';
      const action = options?.action || 'toggle .active on me';
      return `on ${event}
  ${action}
end`;
    },
    
    'fetch-request': (options) => {
      const url = options?.url || '/api/data';
      const method = options?.method || 'GET';
      const processResponse = options?.processResponse || 'put it into me';
      
      return `on ${options?.trigger || 'click'}
  fetch "${url}" ${method !== 'GET' ? `with method: "${method}"` : ''}
    then if it.ok
      ${processResponse}
    else
      put "Error: " + it.status into me
    end
end`;
    },
    
    'animation': (options) => {
      const name = options?.name || 'FadeIn';
      const property = options?.property || 'opacity';
      const from = options?.from ?? '0';
      const to = options?.to ?? '1';
      const duration = options?.duration || '500ms';
      
      return `behavior ${name}
  init
    set my ${property} to ${from}
    then transition my ${property} to ${to} over ${duration}
  end
  
  on click
    if my ${property} is ${to}
      transition my ${property} to ${from} over ${duration}
    else
      transition my ${property} to ${to} over ${duration}
    end
  end
end`;
    },
    
    'form-validation': (options) => {
      const fields = options?.fields || ['email', 'password'];
      const validations = fields.map((field: string) => `
  if #${field}.value is empty
    add .error to #${field}
    put "${field.charAt(0).toUpperCase() + field.slice(1)} is required" into #${field}-error
    set isValid to false
  else
    remove .error from #${field}
    put "" into #${field}-error
  end`).join('\n');
      
      return `on submit
  prevent default
  set isValid to true
${validations}
  
  if isValid
    -- Submit the form
    fetch @action with method: @method, body: values()
      then if it.ok
        put "Success!" into #message
        reset() on me
      else
        put "Error submitting form" into #message
      end
  end
end`;
    },
    
    'todo-item': (options) => {
      const inputId = options?.inputId || '#todo-input';
      const listId = options?.listId || '#todo-list';
      
      return `-- Add todo item
on click from .add-todo-btn
  get value of ${inputId}
  if it is not empty
    make <li.todo-item/> called item
    make <span.todo-text/> called textSpan
    put it into textSpan
    put textSpan into item
    
    make <button.delete-btn/> called deleteBtn
    put "×" into deleteBtn
    put deleteBtn at end of item
    
    put item at end of ${listId}
    set value of ${inputId} to ""
  end
end

-- Toggle completed
on click from .todo-item
  toggle .completed on me
end

-- Delete todo
on click from .delete-btn
  remove closest .todo-item
end`;
    },
    
    'modal': (options) => {
      const modalId = options?.modalId || '#modal';
      const triggerId = options?.triggerId || '.open-modal';
      
      return `-- Open modal
on click from ${triggerId}
  show ${modalId}
  add .modal-open to body
end

-- Close modal
on click from .close-modal or click from .modal-backdrop
  hide ${modalId}
  remove .modal-open from body
end

-- Close on escape key
on keydown[key=="Escape"] from window
  if ${modalId} matches :visible
    hide ${modalId}
    remove .modal-open from body
  end
end`;
    },
    
    'drag-drop': (options) => {
      const draggableClass = options?.draggableClass || '.draggable';
      const dropzoneClass = options?.dropzoneClass || '.dropzone';
      
      return `-- Make items draggable
on dragstart from ${draggableClass}
  set dataTransfer.effectAllowed to "move"
  set dataTransfer.dropEffect to "move"
  add .dragging to me
  set window.draggedElement to me
end

on dragend from ${draggableClass}
  remove .dragging from me
  set window.draggedElement to null
end

-- Handle drop zones
on dragover from ${dropzoneClass}
  prevent default
  add .drag-over to me
end

on dragleave from ${dropzoneClass}
  remove .drag-over from me
end

on drop from ${dropzoneClass}
  prevent default
  remove .drag-over from me
  
  if window.draggedElement exists
    put window.draggedElement at end of me
  end
end`;
    },
    
    'infinite-scroll': (options) => {
      const containerId = options?.containerId || '#content';
      const loadMoreUrl = options?.loadMoreUrl || '/api/items';
      
      return `behavior InfiniteScroll
  init
    set @page to 1
    set @loading to false
    set @hasMore to true
  end
  
  on scroll from window
    if @loading or not @hasMore
      exit
    end
    
    get boundingClientRect() of ${containerId}
    if it.bottom < window.innerHeight + 100
      set @loading to true
      
      fetch "${loadMoreUrl}?page=" + @page
        then if it.ok
          get it.json()
          
          for item in it.items
            make <div.item/> called itemEl
            put item.content into itemEl
            put itemEl at end of ${containerId}
          end
          
          increment @page
          set @hasMore to it.hasMore
        end
        finally
          set @loading to false
        end
    end
  end
end`;
    }
  };
  
  generate(pattern: GeneratePattern, options?: any): string {
    const generator = this.patterns[pattern];
    if (!generator) {
      throw new Error(`Unknown pattern: ${pattern}`);
    }
    return generator(options);
  }
  
  listPatterns(): Array<{ name: GeneratePattern; description: string }> {
    return [
      { name: 'event-handler', description: 'Basic event handler structure' },
      { name: 'fetch-request', description: 'AJAX request with error handling' },
      { name: 'animation', description: 'CSS animation behavior' },
      { name: 'form-validation', description: 'Form validation with error messages' },
      { name: 'todo-item', description: 'Todo list item management' },
      { name: 'modal', description: 'Modal dialog behavior' },
      { name: 'drag-drop', description: 'Drag and drop functionality' },
      { name: 'infinite-scroll', description: 'Infinite scrolling behavior' }
    ];
  }
}