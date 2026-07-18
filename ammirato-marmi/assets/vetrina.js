/* Ammirato Marmi - Sito vetrina - interazioni minime */
(function () {
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 40) { nav.classList.add('scrolled'); }
    else { nav.classList.remove('scrolled'); }
  });
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    var as = links.querySelectorAll('a');
    var i;
    for (i = 0; i < as.length; i++) {
      as[i].addEventListener('click', function () { links.classList.remove('open'); });
    }
  }
})();
