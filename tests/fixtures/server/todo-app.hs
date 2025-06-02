behavior TodoApp
  init
    log "Todo app initialized"
    
  on click from .add-todo-btn
    get value of #todo-input
    if it is not empty
      make <li.todo-item/> called todoItem
      make <span.todo-text/> called textSpan
      put it into textSpan
      put textSpan into todoItem
      
      make <button.delete-btn/> called deleteBtn
      put "×" into deleteBtn
      put deleteBtn at end of todoItem
      
      put todoItem at end of #todo-list
      set value of #todo-input to ""
    end
    
  on click from .todo-item
    toggle .completed on me
    if I match .completed
      log "Task completed"
    else
      log "Task uncompleted"
    end
    
  on click from .delete-btn
    remove closest .todo-item
    log "Task deleted"
    
  on click from #clear-completed
    remove .todo-item.completed from #todo-list
    log "Cleared completed tasks"