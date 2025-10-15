document.addEventListener("DOMContentLoaded", () => {
  // ===== MENU TOGGLE =====
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");

  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    menuToggle.classList.toggle("active");
  });

  // ===== HERO BACKGROUND SLIDESHOW =====
  const hero = document.querySelector(".hero");

  const images = [
    "../images/bhxs s.jpeg",
    "../images/xs ijsq.jpeg",
    "../images/WhatsApp Image 2025-10-775 at 4.21.01 AM.jpeg",
    "../images/WhatsApp Image 2025-10-15 at 4.21.17 AM.jpeg"
  ];

  let index = 0;

  // Initial background setup
  hero.style.backgroundImage = `
    linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.75)),
    url('${images[0]}')
  `;
  hero.style.transition = "background-image 1.5s ease-in-out";

  function changeBackground() {
    index = (index + 1) % images.length;
    hero.style.backgroundImage = `
      linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.75)),
      url('${images[index]}')
    `;
  }

  setInterval(changeBackground, 4000); // changes every 4 seconds
});

 function openPopup() {
    document.getElementById("popup").style.display = "flex";
  }

  function closePopup() {
    document.getElementById("popup").style.display = "none";
  }

  // Optional: Close popup when clicking outside
  window.onclick = function(event) {
    const popup = document.getElementById("popup");
    if (event.target === popup) {
      popup.style.display = "none";
    }
  }