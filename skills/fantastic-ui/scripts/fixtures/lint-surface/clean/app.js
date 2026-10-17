// Reveal on scroll; the reduced-motion path in styles.css shows the final state.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) e.target.classList.add("in");
});
document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
