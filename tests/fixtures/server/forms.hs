behavior FormValidation
  on input from input[required]
    if my value is empty
      add .error to me
      put "This field is required" into next .error-message
    else
      remove .error from me
      put "" into next .error-message
    end
  end
  
  on submit
    prevent default
    
    set isValid to true
    for input in <input[required]/> within me
      if the input's value is empty
        add .error to the input
        set isValid to false
      end
    end
    
    if isValid
      log "Form is valid, submitting..."
      fetch /api/submit {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values())
      }
      then if it.ok
        log "Form submitted successfully"
        reset() on me
      else
        log "Form submission failed"
      end
    else
      log "Form has validation errors"
    end
  end

behavior AutoSave
  init
    set @saveTimer to null
  end
  
  on input debounced at 1000ms
    log "Auto-saving..."
    
    fetch /api/draft {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: my value })
    }
    
    show #save-indicator
    wait 2s
    hide #save-indicator
  end

behavior CharacterCounter
  on input
    set chars to length of my value
    set remaining to 280 - chars
    
    put remaining into #char-count
    
    if remaining < 20
      add .warning to #char-count
    else
      remove .warning from #char-count
    end
    
    if remaining < 0
      add .error to #char-count
      set @disabled to true on button[type="submit"]
    else
      remove .error from #char-count
      set @disabled to false on button[type="submit"]
    end
  end