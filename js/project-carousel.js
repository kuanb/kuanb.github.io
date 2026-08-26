(function () {
  "use strict";

  var carousels = document.querySelectorAll("[data-project-carousel]");

  Array.prototype.forEach.call(carousels, function (carousel) {
    var slides = carousel.querySelectorAll("[data-carousel-slide]");
    var dots = carousel.querySelectorAll("[data-carousel-dot]");
    var previous = carousel.querySelector("[data-carousel-previous]");
    var next = carousel.querySelector("[data-carousel-next]");
    var controls = carousel.querySelector("[data-carousel-controls]");
    var status = carousel.querySelector("[data-carousel-status]");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var current = 0;
    var timer = null;
    var interval = 6500;

    if (slides.length < 2 || !previous || !next || !controls) {
      return;
    }

    controls.hidden = false;

    function render(index, announce) {
      current = (index + slides.length) % slides.length;

      Array.prototype.forEach.call(slides, function (slide, slideIndex) {
        slide.hidden = slideIndex !== current;
      });

      Array.prototype.forEach.call(dots, function (dot, dotIndex) {
        if (dotIndex === current) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });

      if (announce && status) {
        status.textContent = "Showing screenshot " + (current + 1) + " of " + slides.length;
      }
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();

      if (reducedMotion.matches || document.hidden) {
        return;
      }

      timer = window.setInterval(function () {
        render(current + 1, false);
      }, interval);
    }

    previous.addEventListener("click", function () {
      render(current - 1, true);
    });

    next.addEventListener("click", function () {
      render(current + 1, true);
    });

    Array.prototype.forEach.call(dots, function (dot) {
      dot.addEventListener("click", function () {
        render(Number(dot.getAttribute("data-carousel-dot")), true);
      });
    });

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", function (event) {
      if (!carousel.contains(event.relatedTarget)) {
        start();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener("change", start);
    } else if (reducedMotion.addListener) {
      reducedMotion.addListener(start);
    }

    render(0, false);
    start();
  });
}());
