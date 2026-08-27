import { setupMobileNavigation } from './mobile-navigation.js';

(function(){
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* loader */
  var loader = document.getElementById('loader');
  function dismissLoader(){ if (loader) loader.classList.add('done'); }
  window.addEventListener('load', function(){
    setTimeout(dismissLoader, reduced ? 0 : 1350);
  });
  setTimeout(dismissLoader, 2600); // JavaScript failsafe; CSS supplies an independent fallback.

  /* custom cursor */
  if (finePointer && !reduced){
    var dot = document.querySelector('.cursor-dot');
    var ring = document.querySelector('.cursor-ring');
    var mx = -100, my = -100, rx = -100, ry = -100;
    document.addEventListener('mousemove', function(e){ mx = e.clientX; my = e.clientY; }, {passive:true});
    (function loop(){
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('[data-cursor]').forEach(function(el){
      el.addEventListener('mouseenter', function(){ document.body.classList.add('cursor-hover'); });
      el.addEventListener('mouseleave', function(){ document.body.classList.remove('cursor-hover'); });
    });
  }

  /* nav scrolled state */
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function(){
    nav.classList.toggle('scrolled', window.scrollY > 30);
  }, {passive:true});

  /* progressively enhanced mobile navigation */
  setupMobileNavigation();

  /* magnetic buttons */
  if (finePointer && !reduced){
    document.querySelectorAll('.btn').forEach(function(btn){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width/2) * 0.22;
        var y = (e.clientY - r.top - r.height/2) * 0.3;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      btn.addEventListener('mouseleave', function(){ btn.style.transform = ''; });
    });
  }

  /* hero kinetic typography - weight & softness mapped to scroll */
  var heroWord = document.getElementById('heroWord');
  if (!reduced){
    var ticking = false;
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var p = Math.min(window.scrollY / (window.innerHeight * 0.9), 1);
        var wght = 900 - p * 560;
        heroWord.style.fontVariationSettings =
          "'opsz' 144,'wght' " + wght.toFixed(0) + ",'SOFT' 0" +
          ",'WONK' " + (document.body.classList.contains('wonk') ? 1 : 0);
        heroWord.style.opacity = String(1 - p * 0.55);
        ticking = false;
      });
    }, {passive:true});
  }

  /* greeting rotator */
  var greetings = ['Hello —','Olá —','Hola —','Привіт —','Merhaba —','Ciao —','Cześć —','Ahoj —','你好 —','こんにちは —','Γεια σου —'];
  var gEl = document.getElementById('greeting');
  var gi = 0;
  if (!reduced){
    setInterval(function(){
      gEl.style.opacity = '0';
      gEl.style.transform = 'translateY(-12px)';
      setTimeout(function(){
        gi = (gi + 1) % greetings.length;
        gEl.textContent = greetings[gi];
        gEl.style.transition = 'none';
        gEl.style.transform = 'translateY(14px)';
        void gEl.offsetWidth;
        gEl.style.transition = '';
        gEl.style.opacity = '1';
        gEl.style.transform = 'translateY(0)';
      }, 380);
    }, 2200);
  }

  /* duplicate marquee content for seamless loop */
  var track = document.getElementById('marqueeTrack');
  track.innerHTML += track.innerHTML;

  /* correction theater - staged by scroll progress */
  var pinWrap = document.getElementById('pinWrap');
  var pinStage = document.getElementById('pinStage');
  if (!reduced){
    window.addEventListener('scroll', function(){
      var rect = pinWrap.getBoundingClientRect();
      var total = pinWrap.offsetHeight - window.innerHeight;
      var prog = Math.min(Math.max(-rect.top / total, 0), 1);
      pinStage.classList.toggle('s1', prog > 0.18);
      pinStage.classList.toggle('s2', prog > 0.45);
      pinStage.classList.toggle('s3', prog > 0.7);
      if (prog <= 0.18) pinStage.classList.add('s0'); else pinStage.classList.remove('s0');
    }, {passive:true});
    pinStage.classList.add('s0');
  } else {
    pinStage.classList.add('s3');
  }

  /* reveal on scroll */
  var revealTargets = document.querySelectorAll('.reveal, .method-step, .ncard');
  if (!reduced && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold: 0.18});
    revealTargets.forEach(function(el){ io.observe(el); });
  } else {
    revealTargets.forEach(function(el){ el.classList.add('in'); });
  }

  /* stagger method steps & ncards */
  document.querySelectorAll('.method-step').forEach(function(el, i){ el.style.transitionDelay = (i * 0.12) + 's'; });
  document.querySelectorAll('.ncard').forEach(function(el, i){ el.style.transitionDelay = (i * 0.1) + 's'; });

  /* count-ups */
  function countUp(el, target, decimals, dur){
    var start = null;
    function step(ts){
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var countTargets = document.querySelectorAll('[data-count]');
  if (!reduced && 'IntersectionObserver' in window){
    countTargets.forEach(function(el){ el.textContent = '0'; });
    var statIO = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        var el = en.target;
        countUp(el, parseFloat(el.getAttribute('data-count')), 1, 1400);
        statIO.unobserve(el);
      });
    }, {threshold: 0.6});
    countTargets.forEach(function(el){ statIO.observe(el); });
  }

  /* toast helper */
  var toast = document.getElementById('toast');
  var toastTimer;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2600);
  }

  /* EGG 1 - "T" reveals tutor notes (just like Thomas's lesson cards) */
  document.addEventListener('keydown', function(e){
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !/input|textarea/i.test(document.activeElement.tagName)){
      document.body.classList.toggle('show-notes');
      showToast(document.body.classList.contains('show-notes')
        ? '✎ Tutor notes revealed' : 'Tutor notes hidden');
    }
  });

  /* EGG 2 - Konami code -> WONK mode */
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var kPos = 0;
  document.addEventListener('keydown', function(e){
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === konami[kPos]){
      kPos++;
      if (kPos === konami.length){
        kPos = 0;
        document.body.classList.toggle('wonk');
        showToast(document.body.classList.contains('wonk')
          ? '⚡ WONK MODE — Fraunces unleashed' : 'Back to business');
      }
    } else { kPos = (k === konami[0]) ? 1 : 0; }
  });

  /* EGG 3 - click the period in "Say hello." -> greeting confetti */
  var ctaDot = document.getElementById('ctaDot');
  var greetWords = ['Hello!','Olá!','Hola!','Привіт!','Merhaba!','Ciao!','Cześć!','Ahoj!','你好!','こんにちは!','Γεια!'];
  ctaDot.addEventListener('click', function(e){
    if (reduced) { showToast('👋 Hello from Chiapas'); return; }
    for (var i = 0; i < 16; i++){
      (function(i){
        var s = document.createElement('span');
        s.className = 'confetti';
        s.textContent = greetWords[Math.floor(Math.random() * greetWords.length)];
        s.style.left = e.clientX + 'px';
        s.style.top = e.clientY + 'px';
        s.style.color = ['#FF3B1F','#1D3EE8','#B4B2A9'][i % 3];
        s.style.fontSize = (0.9 + Math.random() * 1.1) + 'rem';
        document.body.appendChild(s);
        var ang = Math.random() * Math.PI * 2;
        var dist = 90 + Math.random() * 200;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 120;
        var rot = (Math.random() - 0.5) * 240;
        s.animate([
          {transform:'translate(0,0) rotate(0deg)', opacity:1},
          {transform:'translate(' + dx + 'px,' + (dy + 250) + 'px) rotate(' + rot + 'deg)', opacity:0}
        ], {duration: 1100 + Math.random() * 600, easing:'cubic-bezier(.16,1,.3,1)'}).onfinish = function(){ s.remove(); };
      })(i);
    }
    showToast('🎉 ' + document.body.dataset.publicReviewCount + ' five-star hellos and counting');
  });

  /* bottom secret */
  var secret = document.getElementById('bottomSecret');
  window.addEventListener('scroll', function(){
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4){
      secret.classList.add('found');
    }
  }, {passive:true});

})();
