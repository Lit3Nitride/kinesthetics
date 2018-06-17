document.addEventListener('contextmenu', event => event.preventDefault())

var t=0,
    aspect = 16/9

$(document).ready(function() {
var doResize = function() {
  setTimeout(function() {
    if ($(window).width()/aspect < $(window).height()) {
      $('body')
        .width($(window).width())
        .height($(window).width()/aspect)
        .css('margin-left', 0)
        .css('margin-top', ($(window).height() - ($(window).width()/aspect))/2 )
        $('.sweep .sweep-c')
          .width($(window).width())
          .height($(window).width()/aspect)
    } else {
      $('body')
        .height($(window).height())
        .width($(window).height()*aspect)
        .css('margin-top', 0)
        .css('margin-left', ($(window).width() - ($(window).height()*aspect))/2 )
      $('.sweep .sweep-c')
        .width($(window).height()*aspect)
        .height($(window).height())
    }
  }, 1000)
}

window.onresize = doResize
window.onresize()

$(document).mousedown(function(event) {
    event.preventDefault()
    switch (event.which) {
        case 1:
          change()
          break;
        case 2:
        case 3:
          change(false)
          break;
    }
})

$("body").keydown(function(e) {
   if (e.keyCode == 8 || e.keyCode == 37 || e.keyCode == 38){
     change(false)
   }
   if(e.keyCode == 32 || e.keyCode == 39 || e.keyCode == 40){
     change()
   }
});

function change(next) {
  if ($('html, body').hasClass('init')) {
    $('html, body').removeClass('init')
  } else {
    if (next !== false) {
      if (t < tMap.length) {
        t++
        $('html, body').addClass("t" + tMap[t-1])
      }
    } else if (t > 0) {
      $('html, body').removeClass("t" + tMap[t-1])
      t--
    }
  }
}
})
