behavior SlideShow
  init
    set currentSlide to 0
    set slideCount to (count of .slide)
    call showSlide(currentSlide)
    
  def showSlide(index)
    hide .slide
    show .slide[index]
    set currentSlide to index
  end
  
  on click from .next-btn
    if currentSlide < slideCount - 1
      increment currentSlide
      call showSlide(currentSlide)
      transition opacity of .slide[currentSlide] from 0 to 1 over 300ms
    end
  end
  
  on click from .prev-btn
    if currentSlide > 0
      decrement currentSlide
      call showSlide(currentSlide)
      transition opacity of .slide[currentSlide] from 0 to 1 over 300ms
    end
  end
  
  on keydown[key=="ArrowRight"]
    trigger click on .next-btn
  end
  
  on keydown[key=="ArrowLeft"]
    trigger click on .prev-btn
  end

behavior FadeToggle
  on click
    if my opacity is 0
      transition my opacity to 1 over 500ms
    else
      transition my opacity to 0 over 500ms
    end
  end

behavior Accordion
  on click from .accordion-header
    toggle .expanded on closest .accordion-item
    
    if the closest .accordion-item matches .expanded
      measure me
      transition height of next .accordion-content from 0 to scrollHeight over 200ms
    else
      transition height of next .accordion-content to 0 over 200ms
    end
  end